import { expect, it, vi } from "vitest";
import { accessLimitKey, reserveAccess } from "@/server/access-limits";
import * as connection from "@/server/persistence/connection";

it("normalizes and HMACs emails without storing identities", () => {
  process.env.AUTH_SECRET = "test-secret-for-access-limits-only-32";
  expect(accessLimitKey("login", " A@EXAMPLE.COM ")).toBe(accessLimitKey("login", "a@example.com"));
  expect(accessLimitKey("login", "a@example.com")).not.toContain("a@example.com");
  expect(accessLimitKey("registration")).toBe(accessLimitKey("registration", "untrusted-header"));
});

it("does not grant reservations when persistence fails", async () => {
  const spy = vi.spyOn(connection, "dbConnect").mockRejectedValueOnce(new connection.DatabaseConnectionError());
  await expect(reserveAccess("registration")).rejects.toThrow("MongoDB connection failed");
  spy.mockRestore();
});
