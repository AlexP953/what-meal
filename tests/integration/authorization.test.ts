import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
const requestState = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: requestState.cookie }) }));
import { requireSession, isAdmin } from "@/lib/authz";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
const database = isolatedDatabase();
beforeAll(async () => { database.configure(); process.env.AUTH_SECRET = "authorization-tests-only-secret-32"; await prepareDatabase(); });
afterAll(() => database.cleanup());

it("uses the current database role, rejects revoked/deleted sessions and exposes no private claims", async () => {
  expect((await requireSession()).error?.status).toBe(401);
  const user = await User.create({ email: "authorization@example.com", passwordHash: "hash" });
  const token = await encode({ token: { uid: user.id, role: "admin", authVersion: 0, signedInAt: Date.now() }, secret: process.env.AUTH_SECRET!, salt: "authjs.session-token" });
  requestState.cookie = `authjs.session-token=${token}`;
  expect(isAdmin((await requireSession()).session)).toBe(false);
  await User.updateOne({ _id: user._id }, { role: "admin" });
  const active = (await requireSession()).session;
  expect(isAdmin(active)).toBe(true);
  expect(JSON.stringify(active)).not.toMatch(/authVersion|signedInAt|password|hash/);
  await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
  expect((await requireSession()).error?.status).toBe(401);
  await User.updateOne({ _id: user._id }, { $set: { authVersion: 0 } });
  await User.deleteOne({ _id: user._id });
  expect((await requireSession()).error?.status).toBe(401);
});
