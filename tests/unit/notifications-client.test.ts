import { afterEach, expect, it, vi } from "vitest";

vi.mock("firebase/app", () => { throw new Error("Firebase must not load"); });

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("does not initialize Firebase when notifications are disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_NOTIFICATIONS_ENABLED", "false");

  const { getClientMessaging } = await import("@/lib/firebase");
  expect(await getClientMessaging()).toBeNull();
});
