import { expect, it, vi } from "vitest";
vi.mock("@/server/persistence/connection", () => ({ dbConnect: vi.fn().mockRejectedValue(new Error("private database detail")) }));
import { verifySessionAccount } from "@/server/session-account";
it("rejects malformed identities before persistence and fails closed on persistence errors", async () => {
  expect(await verifySessionAccount("bad", 0)).toEqual({ status: "invalid" });
  expect(await verifySessionAccount("507f1f77bcf86cd799439011", -1)).toEqual({ status: "invalid" });
  expect(await verifySessionAccount("507f1f77bcf86cd799439011", 0)).toEqual({ status: "unavailable" });
});
