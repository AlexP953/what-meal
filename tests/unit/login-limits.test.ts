import { expect, it } from "vitest";
import { adaptAuthResponse, withoutSessionCookie } from "@/server/auth-response";

it("preserves Auth.js redirect JSON and cookies while returning HTTP 429", async () => {
  const url = "http://localhost/api/auth/signin?error=CredentialsSignin&code=rate_limited_123";
  const response = adaptAuthResponse(Response.json({ url }, { headers: { "set-cookie": "csrf=test-only; HttpOnly; SameSite=Lax" } }), { status: 429, retryAfter: 123 });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("123");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(await response.json()).toEqual({ url });
});

it("preserves a persistence failure redirect and leaves ordinary responses alone", () => {
  const url = "http://localhost/api/auth/signin?error=CredentialsSignin&code=persistence_unavailable";
  const redirect = Response.redirect(url);
  expect(adaptAuthResponse(redirect).status).toBe(302);
  const failed = adaptAuthResponse(redirect, { status: 503 });
  expect(failed.status).toBe(503);
  expect(failed.headers.get("location")).toBe(url);
});

it("retains CSRF cookies when filtering ordinary, secure and chunked session cookies", async () => {
  const csrf = "authjs.csrf-token=test-only; HttpOnly; SameSite=Lax";
  const headers = new Headers();
  headers.append("Set-Cookie", csrf);
  for (const name of ["authjs.session-token", "__Secure-authjs.session-token", "authjs.session-token.0", "__Secure-authjs.session-token.1"]) {
    headers.append("Set-Cookie", `${name}=test-only; HttpOnly`);
  }
  const response = withoutSessionCookie(Response.json({ user: { id: "test" } }, { headers }));
  expect(response.headers.getSetCookie()).toEqual([csrf]);
  expect(await response.json()).toEqual({ user: { id: "test" } });
});
