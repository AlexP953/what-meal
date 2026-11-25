import { afterEach, expect, it, vi } from "vitest";
import { authConfig } from "@/lib/auth.config";
const fixture = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock("@/lib/db", () => ({ dbConnect: vi.fn() }));
vi.mock("@/server/persistence/user", () => ({ User: { findOne: () => ({ select: () => ({ lean: async () => fixture.user }) }) } }));
vi.mock("bcryptjs", () => ({ default: { compare: async (password: string) => password === "old" } }));
import { authorizeCredentials } from "@/server/credentials";
afterEach(() => vi.useRealTimers());

it("accepts old passwords, validates types and never distinguishes wrong credentials", async () => {
  fixture.user = { _id: "507f1f77bcf86cd799439011", email: "a@example.com", role: "user", passwordHash: "private", authVersion: 3 };
  expect(await authorizeCredentials({ email: " A@EXAMPLE.COM ", password: "old" })).toMatchObject({ id: fixture.user._id, authVersion: 3 });
  expect(await authorizeCredentials({ email: {}, password: "old" })).toBeNull();
  expect(await authorizeCredentials({ email: "a@example.com", password: "wrong" })).toBeNull();
  fixture.user = null;
  expect(await authorizeCredentials({ email: "a@example.com", password: "old" })).toBeNull();
});

it("keeps the original login time, ignores updates, and rejects old or expired JWTs", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01Z"));
  const callback = authConfig.callbacks.jwt;
  const call = (args: unknown) => callback(args as Parameters<typeof callback>[0]);
  const original = await call({ token: {}, user: { id: "account", role: "user", authVersion: 0 } });
  expect(original).toMatchObject({ uid: "account", authVersion: 0, signedInAt: Date.now() });
  const sessionCallback = authConfig.callbacks.session;
  const session = await sessionCallback({ session: { user: { name: "Ana" }, expires: "2027-01-01Z" }, token: original } as Parameters<typeof sessionCallback>[0]);
  expect(session).toEqual({ user: { name: "Ana", id: "account", role: "user" }, expires: "2026-01-02T00:00:00.000Z" });
  vi.advanceTimersByTime(23 * 3600000);
  expect(await call({ token: original, trigger: "update", session: { id: "admin", role: "admin", signedInAt: Date.now(), authVersion: 5 } })).toEqual(original);
  vi.advanceTimersByTime(3600000);
  expect(await call({ token: original })).toBeNull();
  expect(await call({ token: { uid: "account", role: "admin" } })).toBeNull();
});
