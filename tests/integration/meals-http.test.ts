import { afterAll, beforeAll, expect, it } from "vitest";
import { Types } from "mongoose";
import { User } from "@/server/persistence/user";
import { prepareDatabase } from "@/server/persistence/prepare";
import { authClient, isolatedTestApp } from "../helpers/app";
import { isolatedDatabase } from "../helpers/database";

const database = isolatedDatabase();
const workspace = isolatedTestApp();
const collection = "/api/meals";
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
  const { baseUrl } = await workspace.start();
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
