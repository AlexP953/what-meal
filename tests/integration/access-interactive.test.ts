import { randomBytes } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { startTestApp, authClient, buildTestApp } from "../helpers/app";
const database = isolatedDatabase();
const authSecret = randomBytes(32).toString("hex");
const authConfig = { AUTH_SECRET: authSecret };
let app: Awaited<ReturnType<typeof startTestApp>>;
beforeAll(async () => { database.configure(); await prepareDatabase(); app = await startTestApp("dev", authConfig); }, 60000);
afterAll(async () => { await app?.stop(); await database.cleanup(); });

it.each(["/login", "/register"])("prevents native credential submission before hydration on %s", async path => {
  const html = await (await fetch(app.baseUrl + path)).text();
  const form = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/);
  expect(form?.[0]).toMatch(/^<form\b[^>]*method="post"/i);
  expect(form?.[1]).toMatch(/<button\b[^>]*type="submit"[^>]*\bdisabled/);
});

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

it("retains an issued cookie across a persistence outage without exposing identity", async () => {
  const client = authClient(app.baseUrl);
  const email = "outage@example.com";
  const password = "outage-test-password";
  expect((await client.request("/api/users", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })).status).toBe(201);
  const signedIn = await client.signIn(email, password);
  const sessionCookie = signedIn.headers.getSetCookie().find(cookie => cookie.startsWith("authjs.session-token="))?.split(";")[0];
  expect(sessionCookie).toBeDefined();
  const cookie = sessionCookie!;

  await app.stop();
  app = await startTestApp("dev", { ...authConfig, MONGODB_URI: "mongodb://127.0.0.1:1" });
  try {
    const csrf = await fetch(app.baseUrl + "/api/auth/csrf");
    const csrfCookie = csrf.headers.getSetCookie().find(value => value.startsWith("authjs.csrf-token="))?.split(";")[0];
    const csrfToken = (await csrf.json()).csrfToken;
    expect(csrfCookie).toBeDefined();
    const responses = await Promise.all([
      fetch(app.baseUrl + "/api/auth/session", { headers: { cookie } }),
      fetch(app.baseUrl + "/api/auth/session", {
        method: "POST", headers: { cookie: `${cookie}; ${csrfCookie}`, "content-type": "application/json" },
        body: JSON.stringify({ csrfToken, data: { user: { role: "admin" } } }),
      }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ code: "PERSISTENCE_UNAVAILABLE", error: "Servicio temporalmente no disponible" });
    }
  } finally {
    await app.stop();
    app = await startTestApp("dev", authConfig);
  }
  const recovered = await fetch(app.baseUrl + "/api/auth/session", { headers: { cookie } });
  expect(recovered.status).toBe(200);
  expect((await recovered.json()).user).toMatchObject({ email, role: "user" });
}, 60000);

it("uses the canonical HTTPS origin and Secure cookies without AUTH_TRUST_HOST", async () => {
  const client = authClient(app.baseUrl);
  const email = "secure@example.com";
  const password = "secure-test-password";
  expect((await client.request("/api/users", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })).status).toBe(201);
  await app.stop();
  await buildTestApp();
  app = await startTestApp("start", { AUTH_URL: "https://whatmeal.example", AUTH_TRUST_HOST: "" });
  try {
    const client = authClient(app.baseUrl);
    const response = await client.signIn(email, password);
    expect(new URL((await response.json()).url).origin).toBe("https://whatmeal.example");
    const cookies = response.headers.getSetCookie().filter(value => value.startsWith("__Secure-authjs.session-token="));
    expect(cookies).toHaveLength(1);
    expect(cookies.every(value => value.includes("; Secure") && value.includes("HttpOnly") && value.includes("SameSite=Lax"))).toBe(true);
    expect((await (await client.request("/api/auth/session")).json()).user).toMatchObject({ email, role: "user" });
  } finally {
    await app.stop();
    app = await startTestApp("dev", authConfig);
  }
}, 120000);
