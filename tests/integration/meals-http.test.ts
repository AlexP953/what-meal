import { randomBytes } from "node:crypto";
import { encode } from "next-auth/jwt";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Types } from "mongoose";
import { Meal } from "@/server/persistence/meal";
import { User } from "@/server/persistence/user";
import { prepareDatabase } from "@/server/persistence/prepare";
import { authClient, isolatedTestApp } from "../helpers/app";
import { isolatedDatabase } from "../helpers/database";

const database = isolatedDatabase();
const workspace = isolatedTestApp();
const collection = "/api/meals";
const secret = randomBytes(32).toString("hex");
let baseUrl: string;
const password = "initial-password-12";
const dish = { name: "Soup", date: "2024-02-29", type: "lunch", reaction: "good", place: "Home", notes: "Warm" };
type Client = ReturnType<typeof authClient>;
let anonymous: Client;
let owner: Client;
let other: Client;
let admin: Client;
let ownerId: string;
let otherId: string;
let adminId: string;

function jsonRequest(method: string, body: unknown, headers?: HeadersInit): RequestInit {
  return { method, body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } };
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: expect.any(String), code });
}

async function createMeal(client: Client = owner, fields: Record<string, unknown> = {}) {
  const response = await client.request(collection, jsonRequest("POST", { ...dish, ...fields }));
  expect(response.status).toBe(201);
  return response.json();
}

beforeAll(async () => {
  database.configure();
  await prepareDatabase();
  ({ baseUrl } = await workspace.start("dev", { AUTH_SECRET: secret }));
  anonymous = authClient(baseUrl);
  async function register(name: string) {
    const email = name + "@example.com";
    const result = await anonymous.request("/api/users", jsonRequest("POST", { email, password }));
    expect(result.status).toBe(201);
    const { id } = await result.json();
    const client = authClient(baseUrl);
    expect((await client.signIn(email, password)).status).toBe(200);
    return { id, client };
  }
  ({ id: ownerId, client: owner } = await register("owner"));
  ({ id: otherId, client: other } = await register("other"));
  ({ id: adminId, client: admin } = await register("admin"));
  await User.updateOne({ _id: adminId }, { role: "admin" });
}, 120000);

afterAll(async () => {
  try { await workspace.cleanup(); }
  finally { await database.cleanup(); }
});

it("returns the detail envelope only to the owner or a current administrator", async () => {
  const created = await createMeal(owner, { userId: otherId });
  expect(created.user).toBe(ownerId);
  const path = collection + "/" + created.id;
  for (const client of [owner, admin]) {
    const response = await client.request(path);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toEqual({ meal: {
      _id: created.id, id: created.id, userId: ownerId, ...dish,
      createdAt: created.createdAt, updatedAt: created.updatedAt,
    } });
    expect(new Date(result.meal.createdAt).toISOString()).toBe(result.meal.createdAt);
  }
  await expectError(await other.request(path), 403, "FORBIDDEN");
  await expectError(await anonymous.request(path), 401, "UNAUTHORIZED");
  await expectError(await owner.request(collection + "/invalid"), 400, "INVALID_INPUT");
  await expectError(await owner.request(collection + "/" + new Types.ObjectId()), 404, "MEAL_NOT_FOUND");

  await User.updateOne({ _id: adminId }, { role: "user" });
  try { await expectError(await admin.request(path), 403, "FORBIDDEN"); }
  finally { await User.updateOne({ _id: adminId }, { role: "admin" }); }
}, 30000);

it("updates only supplied fields, retaining ownership and allowing empty text", async () => {
  const { id } = await createMeal();
  const path = collection + "/" + id;
  const edit = jsonRequest("PATCH", { date: "2028-02-29", place: "", notes: "", userId: adminId });
  await expectError(await other.request(path, edit), 403, "FORBIDDEN");
  await expectError(await owner.request(path, jsonRequest("PATCH", {}, { origin: "https://foreign.example" })), 403, "FORBIDDEN_ORIGIN");
  for (const body of ["{", "null", "[]", "{}", JSON.stringify({ userId: otherId }), JSON.stringify({ date: "2026-02-29" })]) {
    await expectError(await owner.request(path, { method: "PATCH", body }), 400, "INVALID_INPUT");
  }

  const response = await admin.request(path, edit);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ meal: { ...dish, id, userId: ownerId, date: "2028-02-29", place: "", notes: "" } });
  expect((await (await owner.request(path)).json()).meal).toMatchObject({ id, userId: ownerId, date: "2028-02-29", place: "", notes: "" });
  const ownedEdit = await owner.request(path, jsonRequest("PATCH", { name: "Salad" }));
  expect(ownedEdit.status).toBe(200);
  expect((await ownedEdit.json()).meal).toMatchObject({ name: "Salad", date: "2028-02-29", userId: ownerId });
});

it("deletes only after session, origin, id and owner checks", async () => {
  const { id } = await createMeal();
  const path = collection + "/" + id;
  const remove = { method: "DELETE" };
  await expectError(await owner.request(path, { ...remove, headers: { "sec-fetch-site": "cross-site" } }), 403, "FORBIDDEN_ORIGIN");
  await expectError(await other.request(path, remove), 403, "FORBIDDEN");
  await expectError(await owner.request(collection + "/invalid", remove), 400, "INVALID_INPUT");
  expect((await owner.request(path)).status).toBe(200);
  const deleted = await admin.request(path, remove);
  expect(deleted.status).toBe(200);
  expect(await deleted.json()).toEqual({ message: expect.any(String) });
  await expectError(await owner.request(path), 404, "MEAL_NOT_FOUND");
  await expectError(await owner.request(path, remove), 404, "MEAL_NOT_FOUND");
  const second = await createMeal();
  expect((await owner.request(collection + "/" + second.id, remove)).status).toBe(200);
});

it("rejects all routes for absent, expired, revoked and removed sessions", async () => {
  const email = "session-state@example.com";
  const registration = await anonymous.request("/api/users", jsonRequest("POST", { email, password }));
  expect(registration.status).toBe(201);
  const { id } = await registration.json();
  const client = authClient(baseUrl);
  expect((await client.signIn(email, password)).status).toBe(200);
  const created = await createMeal(client);
  const path = collection + "/" + created.id;
  const requests = [
    [collection, {}],
    [collection, jsonRequest("POST", dish)],
    [path, {}],
    [path, jsonRequest("PATCH", { name: "Salad" })],
    [path, { method: "DELETE" }],
  ] as const;
  const cookieName = "authjs.session-token";
  const token = await encode({
    salt: cookieName, secret,
    token: { uid: id, authVersion: 0, signedInAt: Date.now() - 25 * 60 * 60 * 1000 },
  });
  for (const [route, options] of requests) {
    await expectError(await anonymous.request(route, options), 401, "UNAUTHORIZED");
    await expectError(await fetch(baseUrl + route, { ...options, headers: { ...("headers" in options ? options.headers : {}), cookie: cookieName + "=" + token } }), 401, "UNAUTHORIZED");
  }
  await User.updateOne({ _id: id }, { $inc: { authVersion: 1 } });
  for (const [route, options] of requests) await expectError(await client.request(route, options), 401, "UNAUTHORIZED");
  expect((await client.signIn(email, password)).status).toBe(200);
  expect((await client.request(path)).status).toBe(200);
  await User.deleteOne({ _id: id });
  for (const [route, options] of requests) await expectError(await client.request(route, options), 401, "UNAUTHORIZED");
});

it("combines inclusive filters and sorts deterministically within the authorized account", async () => {
  const query = "?dateFrom=2030-08-10&dateTo=2030-08-13";
  const early = await createMeal(owner, { date: "2030-08-10", reaction: "bad" });
  const late = await createMeal(owner, { date: "2030-08-13" });
  const tie = await createMeal(owner, { date: late.date });
  const latest = await createMeal(owner, { date: late.date });
  const rival = await createMeal(other, { date: late.date });
  const administrative = await createMeal(admin, { date: late.date });
  await createMeal(owner, { date: late.date, reaction: "neutral" });
  await createMeal(owner, { date: late.date, type: "snack" });
  await Meal.collection.updateMany(
    { _id: { $in: [late.id, tie.id].map(id => new Types.ObjectId(id)) } },
    { $set: { createdAt: new Date("2026-01-01Z") } },
  );
  await Meal.collection.updateOne(
    { _id: new Types.ObjectId(latest.id) },
    { $set: { createdAt: new Date("2026-02-01Z") } },
  );

  async function list(client: Client, search: string) {
    const response = await client.request(collection + search);
    expect(response.status).toBe(200);
    return (await response.json() as { id: string; user: string }[]);
  }

  const filters = "&reaction=good&reaction=bad&type=lunch";
  const sameDay = [latest.id, ...[late.id, tie.id].sort().reverse()];
  const expected = [...sameDay, early.id];
  const result = await list(owner, query + filters + "&userId=" + otherId);
  expect(result.map(meal => meal.id)).toEqual(expected);
  expect(result.every(meal => meal.user === ownerId)).toBe(true);
  expect((await list(owner, query + filters + "&sortDir=asc")).map(meal => meal.id)).toEqual([early.id, ...sameDay]);
  expect((await list(owner, "?dateFrom=2030-08-13" + filters)).map(meal => meal.id)).toEqual(sameDay);
  expect((await list(owner, "?dateTo=2030-08-10" + filters)).map(meal => meal.id)).toContain(early.id);
  const throughEarly = await list(owner, "?dateTo=2030-08-10" + filters);
  expect(throughEarly.map(meal => meal.id)).not.toContain(late.id);
  expect((await list(other, query + filters + "&userId=invalid")).map(meal => meal.id)).toEqual([rival.id]);
  expect((await list(admin, query + filters)).map(meal => meal.id)).toEqual([administrative.id]);
  expect((await list(admin, query + filters + "&userId=" + ownerId)).map(meal => meal.id)).toEqual(expected);
  expect(await list(owner, "?dateFrom=2030-08-14")).toEqual([]);

  for (const invalid of [
    "type=tea", "reaction=good&reaction=unknown", "reaction=", "sortDir=up", "dateFrom=2023-02-29",
    "dateTo=2024-02-29T00%3A00%3A00Z", "dateFrom=2030-08-13&dateTo=2030-08-10", "userId=", "userId=abc",
  ]) {
    await expectError(await admin.request(collection + "?" + invalid), 400, "INVALID_INPUT");
  }
});

it("rejects mutations from a stale form before writing, even with an administrator cookie", async () => {
  const created = await createMeal();
  const path = collection + "/" + created.id;
  const stale = { "X-Expected-Account": ownerId };
  const count = await Meal.countDocuments();
  for (const account of ["", `${adminId}, ${adminId}`]) {
    await expectError(await admin.request(collection, jsonRequest("POST", dish, { "X-Expected-Account": account })), 409, "SESSION_ACCOUNT_CHANGED");
  }
  await expectError(await admin.request(collection, jsonRequest("POST", dish, stale)), 409, "SESSION_ACCOUNT_CHANGED");
  await expectError(await admin.request(path, jsonRequest("PATCH", { name: "Wrong account" }, stale)), 409, "SESSION_ACCOUNT_CHANGED");
  await expectError(await admin.request(path, { method: "DELETE", headers: stale }), 409, "SESSION_ACCOUNT_CHANGED");
  expect(await Meal.countDocuments()).toBe(count);
  expect((await (await owner.request(path)).json()).meal.name).toBe(dish.name);

  const expectedActor = { "X-Expected-Account": adminId };
  const post = await admin.request(collection, jsonRequest("POST", { ...dish, userId: ownerId }, expectedActor));
  expect(post.status).toBe(201);
  expect((await post.json()).user).toBe(adminId);
  await expectError(await other.request(path, { method: "DELETE", headers: { "X-Expected-Account": otherId } }), 403, "FORBIDDEN");
  expect((await admin.request(path, jsonRequest("PATCH", { name: "Confirmed" }, expectedActor))).status).toBe(200);
  expect((await admin.request(path, { method: "DELETE", headers: expectedActor })).status).toBe(200);
});
