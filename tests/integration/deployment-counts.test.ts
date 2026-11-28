import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Meal } from "@/server/persistence/meal";
import { User } from "@/server/persistence/user";
import { prepareDatabase } from "@/server/persistence/prepare";
import { isolatedDatabase } from "../helpers/database";

const database = isolatedDatabase();
const email = "whatmeal-counts@example.com";
const otherEmail = "whatmeal-other@example.com";
const failure = "Deployment count check failed. Check the inputs and the read-only connection.\n";

function count(args: string[], uri = process.env.MONGODB_URI) {
  const env = { ...process.env };
  delete env.WHAT_MEAL_TEST_MONGODB_URI;
  if (uri) env.WHAT_MEAL_TEST_MONGODB_URI = uri;
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/deployment-counts.ts", ...args], {
    env,
    encoding: "utf8",
    timeout: 10000,
  });
}

beforeAll(async () => {
  database.configure();
  await prepareDatabase();
  const [owner, other] = await User.create([
    { email, passwordHash: "fixture" },
    { email: otherEmail, passwordHash: "fixture" },
  ]);
  const meal = { name: "Test meal", date: "2026-01-12", type: "lunch", reaction: "good" } as const;
  await Meal.create([{ ...meal, userId: owner._id }, { ...meal, userId: other._id }, { ...meal, userId: other._id }]);
});

afterAll(() => database.cleanup());

it.each([[email.toUpperCase(), "1", 1], [otherEmail, "2", 2]])("counts only meals owned by %s", (account, expected, meals) => {
  const result = count([database.name, account, expected]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({ accounts: 1, meals, passed: true });
});

it.each([[email, "2", 1, 1], ["missing@example.com", "0", 0, 0]])("fails on a count mismatch for %s", (account, expected, accounts, meals) => {
  const result = count([database.name, account, expected]);
  expect(result.status).toBe(1);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({ accounts, meals, passed: false });
});

it.each([
  ["missing secret", "", database.name, email, "1"],
  ["invalid URI", "private-connection-marker", database.name, email, "1"],
  ["missing database", undefined, "", email, "1"],
  ["non-fixture email", undefined, database.name, "account@example.org", "1"],
  ["invalid count", undefined, database.name, email, "1e0"],
])("reports a generic error for %s", (_reason, uri, name, account, expected) => {
  const result = count([name, account, expected], uri);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(failure);
});
