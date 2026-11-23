import { afterAll, beforeAll, expect, it } from "vitest";
import { dbConnect } from "@/server/persistence/connection";
import { User } from "@/app/models/User";
import { serializeUser } from "@/server/persistence/user";
import { isolatedDatabase } from "../helpers/database";
const database = isolatedDatabase();
beforeAll(async () => { database.configure(); await dbConnect(); await User.init(); });
afterAll(() => database.cleanup());

it("normalizes accounts, maintains timestamps and hides private fields", async () => {
  const created = await User.create({ email: "  Person@Example.com  ", passwordHash: "private-hash", fcmToken: "private-token" });
  expect(created._id.toString()).toMatch(/^[a-f0-9]{24}$/);
  expect(created.email).toBe("person@example.com");
  expect(created.role).toBe("user");
  expect(created.createdAt).toBeInstanceOf(Date);
  const read = await User.findById(created._id).orFail();
  expect(read.passwordHash).toBeUndefined();
  expect(read.fcmToken).toBeUndefined();
  const credentials = await User.findById(created._id).select("+passwordHash +fcmToken").lean().orFail();
  expect(credentials.passwordHash).toBe("private-hash");
  for (const publicValue of [created.toJSON(), serializeUser(credentials)]) {
    expect(JSON.stringify(publicValue)).not.toMatch(/private-hash|private-token|passwordHash|fcmToken/);
    expect(publicValue.createdAt).toBe(created.createdAt.toISOString());
  }
  const updated = await User.findByIdAndUpdate(created._id, { name: "Changed" }, { returnDocument: "after", runValidators: true }).orFail();
  expect(updated.name).toBe("Changed");
  expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  await User.deleteOne({ _id: created._id });
  expect(await User.findById(created._id)).toBeNull();
});

it("enforces normalized uniqueness during concurrent creation", async () => {
  const results = await Promise.allSettled([
    User.create({ email: " Race@Example.com ", passwordHash: "hash" }),
    User.create({ email: "race@example.com", passwordHash: "hash" }),
  ]);
  expect(results.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((value) => value.status === "rejected") as PromiseRejectedResult;
  expect(failure.reason.code).toBe(11000);
});

it("requires credentials and valid roles without creating defaults", async () => {
  await expect(User.create({ email: "no-hash@example.com" })).rejects.toThrow();
  await expect(User.create({ passwordHash: "hash" })).rejects.toThrow();
  const invalidRole: Record<string, unknown> = { email: "bad-role@example.com", passwordHash: "hash", role: "owner" };
  await expect(User.create(invalidRole)).rejects.toThrow();
  const user = await User.create({ email: "default@example.com", passwordHash: "hash" });
  expect(user.fcmToken).toBeNull();
});
