import { afterEach, expect, it, vi } from "vitest";
import { checkMutationOrigin } from "@/server/request-origin";
afterEach(() => vi.unstubAllEnvs());
const request = (headers: HeadersInit = {}) => new Request("https://whatmeal.example/api/users/id", { method: "PATCH", headers });
it("rejects foreign, null, and forwarded origins", () => {
  vi.stubEnv("AUTH_URL", "https://whatmeal.example");
  for (const origin of ["https://foreign.example", "null", "https://whatmeal.example.foreign.example", "http://whatmeal.example"]) {
    expect(checkMutationOrigin(request({ origin, "x-forwarded-host": "foreign.example" }))?.status).toBe(403);
  }
  expect(checkMutationOrigin(request({ "sec-fetch-site": "cross-site" }))?.status).toBe(403);
});
it("permits same-origin browser requests and nonbrowser requests without an Origin", () => {
  vi.stubEnv("AUTH_URL", "");
  expect(checkMutationOrigin(request({ origin: "https://whatmeal.example", "sec-fetch-site": "same-origin" }))).toBeUndefined();
  expect(checkMutationOrigin(request())).toBeUndefined();
});
it("uses the configured canonical origin without trusting forwarded headers", () => {
  vi.stubEnv("AUTH_URL", "https://canonical.example");
  expect(checkMutationOrigin(request({ origin: "https://canonical.example" }))).toBeUndefined();
  expect(checkMutationOrigin(request({ origin: "https://whatmeal.example" }))?.status).toBe(403);
  vi.stubEnv("AUTH_URL", "invalid");
  expect(checkMutationOrigin(request())?.status).toBe(403);
});
