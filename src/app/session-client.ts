const sessionChannel = "whatmeal-session-change";
const authLock = "whatmeal-auth-request";
const sender = `${Date.now()}:${Math.random()}`;

function announceSessionChange() {
  try {
    localStorage.setItem(sessionChannel, `${Date.now()}:${Math.random()}`);
  } catch {
    // The channel also reaches open tabs when storage is unavailable.
  }
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(sessionChannel);
  channel.postMessage(sender);
  channel.close();
}

export function watchSessionChange(onChange: () => void) {
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(sessionChannel);
  function onStorage(event: StorageEvent) {
    if (event.key === sessionChannel) onChange();
  }
  window.addEventListener("storage", onStorage);
  channel?.addEventListener("message", (event: MessageEvent) => {
    if (event.data !== sender) onChange();
  });
  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}

function withAuthLock<T>(mode: LockMode, action: () => Promise<T>, signal?: AbortSignal) {
  return globalThis.navigator?.locks
    ? navigator.locks.request(authLock, { mode, signal }, action)
    : action();
}

export function holdDiaryLock(signal: AbortSignal, work: () => Promise<void>) {
  const locks = navigator.locks;
  if (!locks) return Promise.reject(new Error("Web Locks unavailable"));
  return locks.request(authLock, { mode: "shared", signal }, work);
}

export async function postAuth(
  path: "callback/credentials" | "signout",
  fields: URLSearchParams,
  confirm?: (response: Response) => Promise<void>,
) {
  // Other diaries release their shared lock only after hiding private content.
  announceSessionChange();
  // A new diary may subscribe while the exclusive request is queued.
  const notifyWhileQueued = setInterval(announceSessionChange, 250);
  try {
    return await withAuthLock("exclusive", async () => {
      clearInterval(notifyWhileQueued);
      const csrf = await fetch("/api/auth/csrf", { cache: "no-store" });
      if (!csrf.ok) return null;
      const { csrfToken } = await csrf.json();
      if (typeof csrfToken !== "string" || !csrfToken) return null;

      fields.set("csrfToken", csrfToken);
      const response = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "X-Auth-Return-Redirect": "1" },
        body: fields,
      });
      await confirm?.(response);
      return response;
    });
  } finally {
    clearInterval(notifyWhileQueued);
    // A failed response can still have changed the browser's cookie.
    announceSessionChange();
  }
}

export type SessionCheck =
  | { status: "verified"; userId: string; expiresAt: number }
  | { status: "absent" | "unavailable" | "unsupported" };

export async function readSession(signal?: AbortSignal): Promise<SessionCheck> {
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
