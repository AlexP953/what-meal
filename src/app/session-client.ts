const sessionChannel = "whatmeal-session-change";
const authLock = "whatmeal-auth-request";
const admissionLock = "whatmeal-auth-admission";
const sender = `${Date.now()}:${Math.random()}`;
let nextAttempt = 0;

function announceSessionChange(attempt: string) {
  try {
    localStorage.setItem(sessionChannel, attempt);
  } catch {
    // The channel also reaches open tabs when storage is unavailable.
  }
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(sessionChannel);
  channel.postMessage(attempt);
  channel.close();
}

export function watchSessionChange(onChange: (attempt: string) => void) {
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(sessionChannel);
  function notify(attempt: unknown) {
    if (typeof attempt === "string" && !attempt.startsWith(`${sender}:`)) onChange(attempt);
  }
  function onStorage(event: StorageEvent) {
    if (event.key === sessionChannel) notify(event.newValue);
  }
  window.addEventListener("storage", onStorage);
  channel?.addEventListener("message", (event: MessageEvent) => notify(event.data));
  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}

export async function holdDiaryLock(signal: AbortSignal, work: () => Promise<void>) {
  const locks = navigator.locks;
  if (!locks) throw new Error("Web Locks unavailable");

  let diary: Promise<void> | undefined;
  // Release admission after queuing the diary lock, not after closing the diary.
  await locks.request(admissionLock, { mode: "shared", signal }, () => {
    const queued = Promise.resolve(locks.request(authLock, { mode: "shared", signal }, work));
    diary = queued;
    void queued.catch(() => {}); // The caller receives this rejection after admission releases.
  });
  await diary;
}

export async function postAuth(
  path: "callback/credentials" | "signout",
  fields: URLSearchParams,
  confirm?: (response: Response, signal: AbortSignal) => Promise<void>,
) {
  const locks = globalThis.navigator?.locks;
  const waiting = AbortSignal.timeout(15_000);
  const attempt = `${sender}:${++nextAttempt}`;

  async function request() {
    const signal = AbortSignal.timeout(20_000);
    const csrf = await fetch("/api/auth/csrf", { cache: "no-store", signal });
    if (!csrf.ok) return null;
    const { csrfToken } = await csrf.json();
    if (typeof csrfToken !== "string" || !csrfToken) return null;

    fields.set("csrfToken", csrfToken);
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "X-Auth-Return-Redirect": "1" },
      body: fields,
      signal,
    });
    await confirm?.(response, signal);
    return response;
  }

  if (!locks) return request();
  return locks.request(admissionLock, { signal: waiting }, async () => {
    // Admission stays closed until the attempt settles and the cookie can be checked.
    announceSessionChange(attempt);
    return locks.request(authLock, { signal: waiting }, request);
  });
}

export type VerifiedSession = { status: "verified"; userId: string; expiresAt: number };
export type SessionCheck =
  | VerifiedSession
  | { status: "absent" | "unavailable" | "unsupported" };

export async function readSession(lifetime?: AbortSignal): Promise<SessionCheck> {
  const timeout = AbortSignal.timeout(20_000);
  const signal = lifetime ? AbortSignal.any([lifetime, timeout]) : timeout;
  try {
    const response = await fetch("/api/auth/session", { signal, cache: "no-store" });
    if (response.status === 401) return { status: "absent" };
    if (!response.ok) return { status: "unavailable" };

    const data = await response.json();
    if (data === null) return { status: "absent" };
    const userId = data?.user?.id;
    const expiresAt = typeof data?.expires === "string" ? Date.parse(data.expires) : NaN;
    if (typeof userId !== "string" || !userId || !Number.isFinite(expiresAt)) {
      return { status: "unavailable" };
    }
    if (expiresAt <= Date.now()) return { status: "absent" };
    return { status: "verified", userId, expiresAt };
  } catch {
    return { status: "unavailable" };
  }
}

export function sameSession(previous: VerifiedSession, next: VerifiedSession) {
  return previous.userId === next.userId && previous.expiresAt === next.expiresAt;
}
