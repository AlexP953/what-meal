import { afterAll, beforeAll, expect, it } from "vitest";
import { Types } from "mongoose";
import { dbConnect } from "@/server/persistence/connection";
import { Meal } from "@/app/models/Meal";
import { serializeMeal } from "@/server/persistence/meal";
import { isolatedDatabase } from "../helpers/database";
const database = isolatedDatabase();
const valid = { userId: new Types.ObjectId(), name: "  Soup  ", date: "2024-02-29", type: "lunch" as const, reaction: "good" as const };
beforeAll(async () => { database.configure(); await dbConnect(); await Meal.init(); });
afterAll(() => database.cleanup());

it("maintains CRUD, references, indexes and public representations", async () => {
  const created = await Meal.create(valid);
  expect(created.name).toBe("Soup");
  expect(created.createdAt).toBeInstanceOf(Date);
  const read = await Meal.findById(created._id).lean().orFail();
  for (const value of [serializeMeal(created), serializeMeal(read)]) {
    expect(value._id).toBe(created._id.toString());
    expect(value.userId).toBe(valid.userId.toString());
    expect(value.date).toBe("2024-02-29");
    expect(value.createdAt).toBe(created.createdAt.toISOString());
  }
  const updated = await Meal.findByIdAndUpdate(created._id, { name: " Salad " }, { returnDocument: "after", runValidators: true }).orFail();
  expect(updated.name).toBe("Salad");
  expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  const indexes = (await Meal.listIndexes()).map((index) => index.key);
  expect(indexes).toEqual(expect.arrayContaining([{ userId: 1, date: -1 }, { userId: 1, type: 1 }, { userId: 1, reaction: 1 }]));
  expect(Meal.schema.path("userId").options.ref).toBe("User");
  await Meal.deleteOne({ _id: created._id });
  expect(await Meal.findById(created._id)).toBeNull();
});

it.each<Record<string, unknown>>([
  { userId: null }, { name: " " }, { date: "2023-02-29" }, { date: "1900-02-29" },
  { date: "2026-04-31" }, { date: "2026-00-10" }, { date: "2026-13-01" },
  { date: "2026-01-01T00:00:00Z" }, { type: "dessert" }, { reaction: "great" },
])("rejects invalid creation and updates: %j", async (patch) => {
  await expect(Meal.create({ ...valid, ...patch })).rejects.toThrow();
  const doc = await Meal.create(valid);
  await expect(Meal.updateOne({ _id: doc._id }, { $set: patch }, { runValidators: true })).rejects.toThrow();
});

it("accepts Gregorian leap centuries without timezone conversion", async () => {
  const doc = await Meal.create({ ...valid, date: "2000-02-29" });
  expect(serializeMeal(doc).date).toBe("2000-02-29");
});
