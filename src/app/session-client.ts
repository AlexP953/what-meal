const sessionChannel = "whatmeal-session-change";

export function announceSessionChange() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(sessionChannel);
  channel.postMessage(null);
  channel.close();
}

export function watchSessionChange(onChange: () => void) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(sessionChannel);
  channel.addEventListener("message", onChange);
  return () => channel.close();
}

export async function postAuth(path: "callback/credentials" | "signout", fields: URLSearchParams) {
  const csrf = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!csrf.ok) return null;
  const { csrfToken } = await csrf.json();
  if (typeof csrfToken !== "string" || !csrfToken) return null;

  fields.set("csrfToken", csrfToken);
  return fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "X-Auth-Return-Redirect": "1" },
    body: fields,
  });
}
