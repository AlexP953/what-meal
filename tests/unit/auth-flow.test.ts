import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import type { AuthConfig } from "@auth/core";

vi.mock("next-auth", async () => {
  const { Auth } = await import("@auth/core");
  const { AuthError, CredentialsSignin } = await import("@auth/core/errors");
  // The Next.js adapter imports extensionless Next.js ESM paths that Node cannot resolve.
  return {
    AuthError,
    CredentialsSignin,
    default(config: AuthConfig) {
      const handle = (request: Request) => Auth(request, { ...config, basePath: "/api/auth", trustHost: true });
      return { handlers: { GET: handle, POST: handle } };
    },
  };
});

vi.mock("@/server/login-access", () => ({
  limitedCredentials: async () => ({
    id: "507f1f77bcf86cd799439011", email: "account@example.com", role: "user", authVersion: 0,
  }),
  LoginLimitError: class extends Error {},
}));
vi.mock("@/server/session-account", () => ({
  verifySessionAccount: async () => ({ status: "invalid" }),
}));

import { GET, POST } from "@/lib/auth";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("returns a generic credential error when an accepted account becomes invalid before issuing its cookie", async () => {
  vi.stubEnv("AUTH_SECRET", "test-only-authentication-secret-32");
  vi.stubEnv("AUTH_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const baseUrl = "http://localhost:3000";
  const csrf = await GET(new NextRequest(baseUrl + "/api/auth/csrf"));
  const csrfToken = (await csrf.json()).csrfToken;
  const cookie = csrf.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");

  const login = await POST(new NextRequest(baseUrl + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { cookie, "content-type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ csrfToken, callbackUrl: baseUrl }),
  }));
  const destination = new URL((await login.json()).url);
  expect(Object.fromEntries(destination.searchParams)).toEqual({ error: "CredentialsSignin", code: "credentials" });
  expect(login.headers.getSetCookie()).toEqual([]);
});
