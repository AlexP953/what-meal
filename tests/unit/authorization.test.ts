import { afterEach, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";

const fixture = vi.hoisted(() => ({ headers: new Headers(), verifyAccount: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => fixture.headers }));
vi.mock("@/server/session-account", () => ({ verifySessionAccount: fixture.verifyAccount }));
import { requireSession } from "@/lib/authz";
import { GET } from "@/app/api/users/route";
import { SESSION_MAX_AGE } from "@/lib/session-claims";

const secret = "authorization-tests-only-secret-32";
const salt = "authjs.session-token";
const user = { id: "507f1f77bcf86cd799439011", email: "account@example.com", name: null, role: "user" };

async function useSessionCookie(signedInAt: number) {
  vi.stubEnv("AUTH_SECRET", secret);
  const token = { uid: user.id, authVersion: 0, signedInAt };
  const cookie = await encode({ secret, salt, token, maxAge: SESSION_MAX_AGE });
  fixture.headers = new Headers({ cookie: `${salt}=${cookie}` });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fixture.verifyAccount.mockReset();
});

it("returns a generic 503 when the account cannot be verified", async () => {
  fixture.verifyAccount.mockResolvedValue({ status: "unavailable" });
  await useSessionCookie(Date.now());
  const result = await requireSession();
  expect(result.error?.status).toBe(503);
  expect(await result.error?.json()).toEqual({ error: expect.any(String), code: "PERSISTENCE_UNAVAILABLE" });
});

it("rejects a protected request at the original expiry even if its cookie was renewed", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
  const lifetime = SESSION_MAX_AGE * 1000;
  await useSessionCookie(Date.now() - lifetime + 1);
  fixture.verifyAccount.mockResolvedValue({ status: "valid", user });
  expect((await GET()).status).toBe(403);
  expect(fixture.verifyAccount).toHaveBeenCalledWith(user.id, 0);

  vi.setSystemTime(Date.now() + 1);
  const expired = await GET();
  expect(expired.status).toBe(401);
  expect(await expired.json()).toMatchObject({ code: "UNAUTHORIZED" });
  expect(fixture.verifyAccount).toHaveBeenCalledTimes(1);
});
