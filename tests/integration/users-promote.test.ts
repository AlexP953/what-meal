import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, expect, it } from "vitest";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
const database = isolatedDatabase();
beforeAll(async () => { database.configure(); await prepareDatabase(); });
afterAll(() => database.cleanup());
async function run(email: string, overrides: Record<string, string> = {}) {
  try {
    const result = await promisify(execFile)("npm", ["run", "users:promote", "--", "--email", email], { env: { ...process.env, ...overrides }, timeout: 12000 });
    return { ...result, code: 0 };
  } catch (error) {
    const result = error as { stdout: string; stderr: string; code: number };
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
  }
}
it("promotes and repeats without modifying anything except the selected role", async () => {
  const user = await User.create({ email: "promote@example.com", passwordHash: "private-test-hash", name: "Ana", fcmToken: "private-test-token" });
  const before = await User.findById(user.id).select("+passwordHash +fcmToken +authVersion").lean();
  for (let count = 0; count < 2; count++) {
    const result = await run(" PROMOTE@EXAMPLE.COM ");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Cuenta promovida a admin");
    expect(["", ".env.local not found. Continuing without it.\n"]).toContain(result.stderr);
  }
  const after = await User.findById(user.id).select("+passwordHash +fcmToken +authVersion").lean();
  expect(after).toEqual({ ...before, role: "admin" });
  expect(await User.countDocuments()).toBe(1);
});
it("reports invalid, missing and unreachable accounts without exposing configuration or creating users", async () => {
  for (const email of ["invalid", "missing@example.com"]) {
    const result = await run(email);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/correo|existe/);
  }
  const failed = await run("promote@example.com", { MONGODB_URI: "mongodb://private-config-marker:private-value@127.0.0.1:1" });
  expect(failed.code).not.toBe(0);
  expect(failed.stderr).toContain("MongoDB");
  expect(failed.stdout + failed.stderr).not.toMatch(/private-config-marker|private-value|private-test-hash|private-test-token/);
  expect(await User.countDocuments()).toBe(1);
});
