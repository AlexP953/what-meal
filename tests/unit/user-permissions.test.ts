import { expect, it } from "vitest";
import { updateUserSchema, updateUserAdminSchema } from "@/lib/validations";
it("validates only authorized fields and rejects empty or malformed changes", () => {
  for (const body of [{}, { name: " " }, { role: "admin" }, { authVersion: 3 }, { password: "old" }, { email: null }]) {
    expect(updateUserSchema.safeParse(body).success).toBe(false);
  }
  expect(updateUserSchema.parse({ email: " NEW@EXAMPLE.COM ", name: " Ana " })).toEqual({ email: "new@example.com", name: "Ana" });
  expect(updateUserAdminSchema.parse({ role: "admin" })).toEqual({ role: "admin" });
});
