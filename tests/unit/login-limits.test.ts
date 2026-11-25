import { expect, it } from "vitest";
import { adaptAuthResponse } from "@/server/auth-response";

it("preserves Auth.js redirect JSON and cookies while returning HTTP 429", async () => {
  const url = "http://localhost/api/auth/signin?error=CredentialsSignin&code=rate_limited_123";
  const response = await adaptAuthResponse(Response.json({ url }, { headers: { "set-cookie": "csrf=test-only; HttpOnly; SameSite=Lax" } }));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("123");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(await response.json()).toEqual({ url });
});

it("preserves redirect transport and does not reinterpret ordinary credential errors", async () => {
  const response = await adaptAuthResponse(new Response(null, { status: 302, headers: { location: "http://localhost/api/auth/signin?error=CredentialsSignin&code=rate_limited_30" } }));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("30");
  const ordinary = Response.json({ url: "http://localhost/api/auth/signin?error=CredentialsSignin&code=credentials" });
  expect(await adaptAuthResponse(ordinary)).toBe(ordinary);
});
