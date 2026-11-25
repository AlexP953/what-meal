import { expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next-auth/jwt", () => ({ getToken: async () => ({ uid: "507f1f77bcf86cd799439011", authVersion: 0, signedInAt: Date.now() }) }));
vi.mock("@/server/session-account", () => ({ verifySessionAccount: async () => ({ status: "unavailable" }) }));
import { requireSession } from "@/lib/authz";
it("returns a generic 503 when the account cannot be verified", async () => {
  process.env.AUTH_SECRET = "authorization-tests-only-secret-32";
  const result = await requireSession();
  expect(result.error?.status).toBe(503);
  expect(await result.error?.json()).toEqual({ error: expect.any(String), code: "PERSISTENCE_UNAVAILABLE" });
});
