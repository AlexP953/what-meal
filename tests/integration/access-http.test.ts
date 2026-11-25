import { execFile } from "node:child_process";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
import { Meal } from "@/server/persistence/meal";
import { isolatedTestApp, authClient } from "../helpers/app";

const workspace = isolatedTestApp();
afterAll(() => workspace.cleanup());

describe.each(["dev", "start"] as const)("empty-install access over HTTP (%s)", mode => {
  const database = isolatedDatabase();
  let app: Awaited<ReturnType<typeof workspace.start>>;
  beforeAll(async () => {
    database.configure();
    await prepareDatabase();
    if (mode === "start") await workspace.build();
    app = await workspace.start(mode);
  }, 120000);
  afterAll(async () => { await app?.stop(); await database.cleanup(); });

  it("completes registration, identity, permissions, revocation and logout with real issued sessions and CSRF", async () => {
    expect(await User.countDocuments()).toBe(0);
    expect(await Meal.countDocuments()).toBe(0);
    const anonymous = authClient(app.baseUrl);
    expect((await anonymous.request("/api/users")).status).toBe(401);
    const credentials = { password: "initial-password-12" };
    const ids: string[] = [];
    for (const name of ["owner", "other", "admin"]) {
      const response = await anonymous.request("/api/users", { method: "POST", headers: { "content-type": "application/json", origin: app.baseUrl }, body: JSON.stringify({ email: `${name}@example.com`, ...credentials }) });
      expect(response.status).toBe(201);
      const account = await response.json();
      expect(account).toMatchObject({ role: "user", name: null });
      ids.push(account.id);
    }
    const [owner, other, admin] = ids;
    expect(await (await anonymous.request("/api/auth/session")).json()).toBeNull();
    expect(await Meal.countDocuments()).toBe(0);
    await promisify(execFile)(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/users-promote.ts", "--email", " ADMIN@EXAMPLE.COM "], { env: process.env });

    const ownerClient = authClient(app.baseUrl), otherClient = authClient(app.baseUrl), adminClient = authClient(app.baseUrl);
    for (const [client, email] of [[ownerClient, "owner"], [otherClient, "other"], [adminClient, "admin"]] as const) {
      expect((await client.signIn(`${email}@example.com`, credentials.password)).status).toBe(200);
    }
    expect((await ownerClient.request(`/api/users/${owner}`)).status).toBe(200);
    expect((await ownerClient.request(`/api/users/${other}`)).status).toBe(403);
    expect((await ownerClient.request("/api/users")).status).toBe(403);
    const updated = await ownerClient.updateSession({ user: { id: admin, role: "admin" }, uid: admin, authVersion: 999, signedInAt: Date.now() + 86400000 });
    expect((await updated.json()).user).toMatchObject({ id: owner, role: "user" });
    expect((await ownerClient.request("/api/users")).status).toBe(403);
    const mutation = (body: unknown, origin = app.baseUrl): RequestInit => ({ method: "PATCH", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
    expect((await ownerClient.request(`/api/users/${owner}`, mutation({ role: "admin" }))).status).toBe(403);
    expect((await ownerClient.request(`/api/users/${owner}`, mutation({ name: "Foreign" }, "https://foreign.example"))).status).toBe(403);
    expect((await adminClient.request(`/api/users/${other}`, mutation({ role: "admin" }))).status).toBe(200);
    expect((await otherClient.request("/api/users")).status).toBe(200);
    expect((await adminClient.request(`/api/users/${other}`, mutation({ role: "user" }))).status).toBe(200);
    expect((await otherClient.request("/api/users")).status).toBe(403);

    expect((await ownerClient.request(`/api/users/${owner}`, mutation({ password: "replacement-password-12" }))).status).toBe(200);
    expect((await ownerClient.request(`/api/users/${owner}`)).status).toBe(401);
    expect((await ownerClient.signIn("owner@example.com", "replacement-password-12")).status).toBe(200);
    const session = await (await ownerClient.request("/api/auth/session")).json();
    expect(session.user).toMatchObject({ id: owner, role: "user" });
    expect(JSON.stringify(session)).not.toMatch(/authVersion|signedInAt|passwordHash|fcmToken/);

    await Meal.create({ userId: other, name: "Preserved", date: "2026-01-01", type: "dinner", reaction: "neutral" });
    expect((await adminClient.request(`/api/users/${other}`, { method: "DELETE", headers: { origin: app.baseUrl } })).status).toBe(200);
    expect((await otherClient.request(`/api/users/${other}`)).status).toBe(401);
    expect(await Meal.countDocuments({ userId: other })).toBe(1);
    expect((await ownerClient.request(`/api/users/${owner}/token`, { method: "POST", body: "invalid" })).status).toBe(503);
    expect((await ownerClient.signOut()).status).toBe(200);
    expect((await ownerClient.request(`/api/users/${owner}`)).status).toBe(401);

    const legacy = await User.create({ email: "legacy@example.com", passwordHash: await bcrypt.hash("old", 12) });
    await User.collection.updateOne({ _id: legacy._id }, { $unset: { authVersion: "" } });
    const legacyClient = authClient(app.baseUrl);
    expect((await legacyClient.signIn(" LEGACY@EXAMPLE.COM ", "old")).status).toBe(200);
    expect((await legacyClient.request(`/api/users/${legacy.id}`)).status).toBe(200);
    expect(app.errorTypes.filter(type => !["CredentialsSignin", "MissingCSRF"].includes(type))).toEqual([]);
  }, 120000);
});
