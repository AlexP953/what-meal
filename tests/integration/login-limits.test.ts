import { beforeAll, afterAll, expect, it } from "vitest";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { startTestApp, authClient } from "../helpers/app";
const database = isolatedDatabase();
let app: Awaited<ReturnType<typeof startTestApp>>;
beforeAll(async () => { database.configure(); await prepareDatabase(); app = await startTestApp(); }, 60000);
afterAll(async () => { await app?.stop(); await database.cleanup(); });
it("limits nonexistent accounts after ten failures through the real Auth.js CSRF transport", async () => {
  const client = authClient(app.baseUrl);
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await client.signIn(" Missing@EXAMPLE.COM ", "incorrect");
    expect(response.status).not.toBe(429);
    const data = await response.json();
    expect(Object.keys(data)).toContain("url");
    expect(data.url).toContain("error=CredentialsSignin");
  }
  const limited = await client.signIn("missing@example.com", "incorrect");
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  expect((await limited.json()).url).toContain("code=rate_limited_");
  expect(await (await client.request("/api/users")).json()).toMatchObject({ code: "UNAUTHORIZED" });
  const noCsrf = await client.request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" }, body: new URLSearchParams({ email: "another@example.com", password: "incorrect" }) });
  expect((await noCsrf.json()).url).toContain("MissingCSRF");
}, 60000);

it("returns safe 503 responses when login persistence is unavailable", async () => {
  await app.stop();
  app = await startTestApp("dev", { MONGODB_URI: "mongodb://127.0.0.1:1" });
  const response = await authClient(app.baseUrl).signIn("any@example.com", "incorrect");
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).toContain("persistence_unavailable");
  expect(body).not.toMatch(/mongodb|127\.0\.0\.1:1["/]|passwordHash/i);
}, 60000);
