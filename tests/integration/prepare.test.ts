import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, it } from "vitest";
import { dbConnect } from "@/server/persistence/connection";
import { prepareDatabase } from "@/server/persistence/prepare";
import { User } from "@/server/persistence/user";
import { Meal } from "@/server/persistence/meal";
import { isolatedDatabase } from "../helpers/database";
const database = isolatedDatabase();
beforeAll(() => database.configure());
afterAll(() => database.cleanup());

it("prepares empty collections and preserves data and extra indexes on repetition", async () => {
  await prepareDatabase();
  expect(await User.countDocuments()).toBe(0);
  expect(await Meal.countDocuments()).toBe(0);
  const connection = await dbConnect();
  const collections = (await connection.connection.listCollections()).map((item) => item.name).sort();
  expect(collections).toEqual(["meals", "users"]);
  const owner = await User.create({ email: "isolated@example.com", passwordHash: "test-only-hash" });
  const meal = await Meal.create({ userId: owner._id, name: "Soup", date: "2026-01-01", type: "dinner", reaction: "neutral" });
  await Meal.collection.createIndex({ notes: 1 }, { name: "consumer_notes" });
  const before = { users: await User.listIndexes(), meals: await Meal.listIndexes() };
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await promisify(execFile)(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/db-prepare.ts"], { env: process.env });
    expect(result.stdout).toContain("Database prepared.");
  }
  expect(await User.listIndexes()).toEqual(before.users);
  expect(await Meal.listIndexes()).toEqual(before.meals);
  expect(await User.countDocuments()).toBe(1);
  expect(await Meal.countDocuments()).toBe(1);
  expect(await Meal.findById(meal._id).lean()).toMatchObject({ name: "Soup" });
});
