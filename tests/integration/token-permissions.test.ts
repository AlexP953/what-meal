import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
const state = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: state.cookie }) }));
vi.mock("@/shared/config", () => ({ notificationsEnabled: true }));
import { POST, DELETE } from "@/app/api/users/[id]/token/route";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
const database = isolatedDatabase();
let owner: string, other: string, admin: string;
beforeAll(async () => {
  database.configure(); process.env.AUTH_SECRET = "token-permissions-test-only-secret-32"; await prepareDatabase();
  const users = await User.create(["owner", "other", "admin"].map(name => ({ email: `${name}@example.com`, passwordHash: "hash", role: name === "admin" ? "admin" as const : "user" as const })));
  [owner, other, admin] = users.map(u => u.id);
});
afterAll(() => database.cleanup());
async function login(id: string) { state.cookie = `authjs.session-token=${await encode({ token: { uid: id, authVersion: 0, signedInAt: Date.now() }, secret: process.env.AUTH_SECRET!, salt: "authjs.session-token" })}`; }
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (token: unknown = "private-notification-token", origin = "http://localhost") => new Request("http://localhost/api/users/token", { method: "POST", headers: { origin }, body: JSON.stringify({ token }) });
it("requires a current owner or administrator without exposing notification tokens", async () => {
  expect((await POST(request(), context(owner))).status).toBe(401);
  await login(other);
  for (const handler of [POST, DELETE]) expect((await handler(request(), context(owner))).status).toBe(403);
  await login(owner);
  const own = await POST(request(), context(owner));
  expect(own.status).toBe(200);
  expect(await own.text()).not.toContain("private-notification-token");
  expect((await User.findById(owner).select("+fcmToken"))!.fcmToken).toBe("private-notification-token");
  expect((await POST(request(42), context(owner))).status).toBe(400);
  expect((await POST(request("token", "http://foreign.example"), context(owner))).status).toBe(403);
  await login(admin);
  expect((await DELETE(request(), context(owner))).status).toBe(200);
  expect((await User.findById(owner).select("+fcmToken"))!.fcmToken).toBeNull();
  expect((await POST(request(), context("507f1f77bcf86cd799439011"))).status).toBe(404);
  expect((await POST(request(), context("invalid"))).status).toBe(400);
});
