import { afterEach, beforeEach, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const mongoGlobal = globalThis as typeof globalThis & {
  whatMealMongo?: { pending: Promise<typeof mongoose> | null };
};
let previousCache: typeof mongoGlobal.whatMealMongo;

beforeEach(() => {
  previousCache = mongoGlobal.whatMealMongo;
  delete mongoGlobal.whatMealMongo;
  vi.resetModules();
  vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017");
  vi.stubEnv("MONGODB_DB", "whatmeal_test_unit");
});

afterEach(() => {
  if (previousCache === undefined) delete mongoGlobal.whatMealMongo;
  else mongoGlobal.whatMealMongo = previousCache;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("shares the exact pending promise and one attempt across module reloads", async () => {
  const attempt = Promise.withResolvers<typeof mongoose>();
  const connect = vi.spyOn(mongoose, "connect").mockReturnValue(attempt.promise);
  const { dbConnect } = await import("@/server/persistence/connection");
  const first = dbConnect();
  expect(dbConnect()).toBe(first);
  vi.resetModules();
  const reloaded = await import("@/server/persistence/connection");
  expect(reloaded.dbConnect()).toBe(first);
  expect(connect).toHaveBeenCalledExactlyOnceWith("mongodb://127.0.0.1:27017", {
    dbName: "whatmeal_test_unit", bufferCommands: false, serverSelectionTimeoutMS: 5000,
  });
  attempt.resolve(mongoose);
  await expect(first).resolves.toBe(mongoose);
  expect(mongoGlobal.whatMealMongo?.pending).toBeNull();
});

it("clears a rejected attempt and retries with current configuration", async () => {
  const attempt = Promise.withResolvers<typeof mongoose>();
  const connect = vi.spyOn(mongoose, "connect").mockReturnValueOnce(attempt.promise)
    .mockResolvedValueOnce(mongoose);
  const { dbConnect } = await import("@/server/persistence/connection");
  const first = dbConnect();
  const rejection = expect(first).rejects.toThrow(/^MongoDB connection failed$/);
  attempt.reject(new Error("private connection details"));
  await rejection;
  expect(mongoGlobal.whatMealMongo?.pending).toBeNull();
  vi.stubEnv("MONGODB_URI", "mongodb://localhost:27018");
  vi.stubEnv("MONGODB_DB", "whatmeal_test_retry");
  const second = dbConnect();
  expect(second).not.toBe(first);
  await expect(second).resolves.toBe(mongoose);
  expect(connect).toHaveBeenCalledTimes(2);
  expect(connect).toHaveBeenLastCalledWith("mongodb://localhost:27018", expect.objectContaining({
    dbName: "whatmeal_test_retry",
  }));
});

it("reuses an established connection without another attempt", async () => {
  vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);
  const connect = vi.spyOn(mongoose, "connect");
  const { dbConnect } = await import("@/server/persistence/connection");
  await expect(dbConnect()).resolves.toBe(mongoose);
  expect(connect).not.toHaveBeenCalled();
});
