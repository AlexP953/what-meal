import { beforeAll, afterAll, expect, it } from "vitest";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { startTestApp, authClient } from "../helpers/app";
const database = isolatedDatabase();
let app: Awaited<ReturnType<typeof startTestApp>>;
beforeAll(async () => { database.configure(); await prepareDatabase(); app = await startTestApp(); }, 60000);
afterAll(async () => { await app?.stop(); await database.cleanup(); });

it("redirects direct meals access before rendering private UI", async () => {
  const response = await authClient(app.baseUrl).request("/meals");
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("/login");
});

it("supports login, reload, same-origin redirects and logout with secure cookie attributes", async () => {
  const client = authClient(app.baseUrl);
  const created = await client.request("/api/users", { method: "POST", headers: { "content-type": "application/json", origin: app.baseUrl }, body: JSON.stringify({ email: "interactive@example.com", password: "123456789012" }) });
  expect(created.status).toBe(201);
  const login = await client.signIn("INTERACTIVE@EXAMPLE.COM", "123456789012", "https://foreign.example/path");
  expect(new URL((await login.json()).url).origin).toBe(app.baseUrl);
  const sessionCookies = login.headers.getSetCookie().filter(value => value.startsWith("authjs.session-token="));
  expect(sessionCookies.length).toBe(1);
  expect(sessionCookies.every(value => value.includes("HttpOnly") && value.includes("SameSite=Lax"))).toBe(true);
  for (let count = 0; count < 2; count++) {
    const session = await (await client.request("/api/auth/session")).json();
    expect(session.user).toMatchObject({ email: "interactive@example.com", role: "user", id: expect.any(String) });
    expect(JSON.stringify(session)).not.toMatch(/authVersion|signedInAt|password|fcmToken/);
    expect((await client.request("/meals")).status).toBe(200);
  }
  const logout = await client.signOut();
  expect((await logout.json()).url).toBe(`${app.baseUrl}/login`);
  expect((await client.request("/api/users")).status).toBe(401);
  expect((await client.request("/meals")).status).toBe(307);
}, 60000);

it("sets Secure cookies when the configured application origin uses HTTPS", async () => {
  await app.stop();
  app = await startTestApp("dev", { AUTH_URL: "https://whatmeal.example" });
  const response = await authClient(app.baseUrl).signIn("interactive@example.com", "123456789012");
  const cookies = response.headers.getSetCookie().filter(value => value.startsWith("__Secure-authjs.session-token="));
  expect(cookies.length).toBe(1);
  expect(cookies.every(value => value.includes("; Secure") && value.includes("HttpOnly") && value.includes("SameSite=Lax"))).toBe(true);
}, 60000);
