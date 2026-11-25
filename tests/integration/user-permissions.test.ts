import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
const state = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: state.cookie }) }));
import { GET as list } from "@/app/api/users/route";
import { GET, PATCH, DELETE } from "@/app/api/users/[id]/route";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
import { Meal } from "@/server/persistence/meal";
import { requireSession } from "@/lib/authz";
const database = isolatedDatabase();
let owner: string, other: string, admin: string;
beforeAll(async () => {
  database.configure(); process.env.AUTH_SECRET = "user-permissions-test-only-secret-32"; await prepareDatabase();
  const users = await User.create(["owner", "other", "admin"].map(name => ({ email: `${name}@example.com`, passwordHash: "private-hash", role: name === "admin" ? "admin" as const : "user" as const })));
  [owner, other, admin] = users.map(u => u.id);
  await Meal.create({ userId: owner, name: "Soup", date: "2026-01-01", type: "dinner", reaction: "good" });
});
afterAll(() => database.cleanup());
async function login(id: string, version = 0) {
  state.cookie = `authjs.session-token=${await encode({ token: { uid: id, authVersion: version, signedInAt: Date.now() }, secret: process.env.AUTH_SECRET!, salt: "authjs.session-token" })}`;
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (id: string, method = "GET", body?: unknown, origin = "http://localhost") => new Request(`http://localhost/api/users/${id}`, { method, headers: { origin, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

it("enforces the owner and administrator account permission matrix", async () => {
  await login(owner);
  expect((await list()).status).toBe(403);
  expect((await GET(request(other), context(other))).status).toBe(403);
  expect((await PATCH(request(other, "PATCH", { name: "Not mine" }), context(other))).status).toBe(403);
  expect((await DELETE(request(other, "DELETE"), context(other))).status).toBe(403);
  expect((await PATCH(request(owner, "PATCH", { role: "admin" }), context(owner))).status).toBe(403);
  const own = await GET(request(owner), context(owner));
  expect(own.status).toBe(200);
  expect((await own.json()).user.meals).toHaveLength(1);
  expect((await PATCH(request(owner, "PATCH", { name: " Ana " }), context(owner))).status).toBe(200);
  await login(admin);
  expect((await list()).status).toBe(200);
  expect((await GET(request(owner), context(owner))).status).toBe(200);
  expect((await PATCH(request(other, "PATCH", { role: "admin" }), context(other))).status).toBe(200);
  await login(other);
  expect((await list()).status).toBe(200);
  await User.updateOne({ _id: other }, { role: "user" });
  expect((await list()).status).toBe(403);
});

it("rejects foreign origins, unknown fields, invalid IDs and concurrent duplicate emails safely", async () => {
  await login(admin);
  expect((await PATCH(request(owner, "PATCH", { name: "Bad" }, "http://foreign.example"), context(owner))).status).toBe(403);
  expect((await PATCH(request(owner, "PATCH", { passwordHash: "attack" }), context(owner))).status).toBe(400);
  expect((await PATCH(request("bad", "PATCH", { name: "Bad" }), context("bad"))).status).toBe(400);
  expect((await DELETE(request("bad", "DELETE"), context("bad"))).status).toBe(400);
  expect((await GET(request("507f1f77bcf86cd799439011"), context("507f1f77bcf86cd799439011"))).status).toBe(404);
  const responses = await Promise.all([owner, other].map(id => PATCH(request(id, "PATCH", { email: " DUP@EXAMPLE.COM " }), context(id))));
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  for (const response of responses) expect(await response.text()).not.toMatch(/passwordHash|authVersion|fcmToken|private-hash/);
});

it("atomically revokes previous sessions on concurrent password changes and preserves orphan meals on deletion", async () => {
  await login(admin);
  const changes = await Promise.all(["first-password-12", "other-password-12"].map(password => PATCH(request(owner, "PATCH", { password }), context(owner))));
  expect(changes.map(r => r.status)).toEqual([200, 200]);
  expect((await User.findById(owner).select("+authVersion"))!.authVersion).toBe(2);
  await login(owner);
  expect((await requireSession()).error?.status).toBe(401);
  await login(admin);
  expect((await DELETE(request(owner, "DELETE"), context(owner))).status).toBe(200);
  expect(await Meal.countDocuments({ userId: owner })).toBe(1);
  await login(owner, 2);
  expect((await requireSession()).error?.status).toBe(401);
});
