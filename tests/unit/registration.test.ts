import { expect, it } from "vitest";
import { registerSchema } from "@/lib/validations";

it("normalizes identity, preserves password whitespace and rejects privilege or unknown fields", () => {
  const input = { email: " A@EXAMPLE.COM ", password: " 1234567890 ", name: " Ana " };
  expect(registerSchema.parse(input)).toEqual({ email: "a@example.com", password: input.password, name: "Ana" });
  for (const extra of [{ role: "user" }, { role: "admin" }, { fcmToken: "private" }]) {
    expect(registerSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  }
});

it("enforces character and UTF-8 byte limits and trimmed names", () => {
  for (const password of ["short", "😀".repeat(6), "é".repeat(37)]) {
    expect(registerSchema.safeParse({ email: "a@example.com", password }).success).toBe(false);
  }
  expect(registerSchema.safeParse({ email: "a@example.com", password: "é".repeat(36) }).success).toBe(true);
  for (const name of [" ", "a".repeat(101), null]) {
    expect(registerSchema.safeParse({ email: "a@example.com", password: "a".repeat(12), name }).success).toBe(false);
  }
});
