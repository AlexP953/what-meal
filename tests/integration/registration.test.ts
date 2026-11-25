import { beforeAll, afterAll, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
vi.mock("@/lib/authz", () => ({ requireSession: vi.fn(), isAdmin: vi.fn(), forbid: vi.fn() }));
import { POST } from "@/app/api/users/route";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
import { Meal } from "@/server/persistence/meal";
const database = isolatedDatabase();
beforeAll(async () => { database.configure(); await prepareDatabase(); });
afterAll(() => database.cleanup());
const request = (body: unknown) => new Request("http://localhost/api/users", { method: "POST", body: JSON.stringify(body) });

it("creates only one normal first account under concurrent normalized duplicates", async () => {
  expect(await User.countDocuments()).toBe(0);
  const responses = await Promise.all([" FIRST@EXAMPLE.COM ", "first@example.com"].map(email => POST(request({ email, password: " twelve chars " }))));
  expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  const created = responses.find(r => r.status === 201)!;
  expect(await created.json()).toEqual({ id: expect.any(String), email: "first@example.com", name: null, role: "user" });
  expect(created.headers.has("set-cookie")).toBe(false);
  const user = await User.findOne().select("+passwordHash");
  expect(await bcrypt.compare(" twelve chars ", user!.passwordHash)).toBe(true);
  expect(bcrypt.getRounds(user!.passwordHash)).toBeGreaterThanOrEqual(12);
  expect(await User.countDocuments()).toBe(1);
  expect(await Meal.countDocuments()).toBe(0);
});

it("returns safe stable errors for malformed JSON, input and quota", async () => {
  const invalid = await POST(request({ email: "other@example.com", password: "123456789012", role: "admin" }));
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: expect.any(String), code: "INVALID_INPUT" });
  const malformed = await POST(new Request("http://localhost/api/users", { method: "POST", body: "{" }));
  expect(malformed.status).toBe(400);
  let limited: Response | undefined;
  for (let index = 0; index < 22; index++) limited = await POST(request({}));
  expect(limited!.status).toBe(429);
  expect(Number(limited!.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await limited!.text()).not.toMatch(/password|hash|token|exception/i);
});
