import { afterAll, expect, it } from "vitest";
import { dbConnect } from "@/lib/db";
import { isolatedDatabase } from "../helpers/database";

const database = isolatedDatabase();
afterAll(() => database.cleanup());

it("recovers after a failed attempt and shares concurrent connections", async () => {
  database.configure();
  const uri = process.env.MONGODB_URI!;
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100";
  await expect(dbConnect()).rejects.toThrow();
  process.env.MONGODB_URI = uri;
  const first = dbConnect();
  const second = dbConnect();
  const [a, b] = await Promise.all([first, second]);
  expect(a).toBe(b);
  expect(a.connection.name).toBe(database.name);
  await a.connection.collection("probe").insertOne({ marker: "live" });
  expect(await b.connection.collection("probe").findOne({ marker: "live" })).not.toBeNull();
});
