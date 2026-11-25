import { expect, it, vi } from "vitest";
import { mongo, Types } from "mongoose";
const fixture = vi.hoisted(() => ({ meal: {} as Record<string, unknown>, connect: vi.fn() }));
vi.mock("@/lib/authz", () => ({
  requireSession: async () => ({ session: { user: { id: "507f1f77bcf86cd799439011", role: "admin" } } }),
  isAdmin: () => true,
  forbid: () => Response.json({}, { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ dbConnect: fixture.connect }));
vi.mock("@/server/persistence/meal", async (importOriginal) => ({ ...await importOriginal<typeof import("@/server/persistence/meal")>(), Meal: {
  find: () => ({ sort: () => ({ lean: async () => [fixture.meal] }) }),
  findById: () => ({ lean: async () => fixture.meal }),
  create: async (input: Record<string, unknown>) => ({
    ...input, _id: new Types.ObjectId("507f1f77bcf86cd799439012"),
    createdAt: new Date("2026-01-01Z"), updatedAt: new Date("2026-01-01Z"),
  }),
} }));
import { GET as list, POST as create } from "@/app/api/meals/route";
import { GET as detail } from "@/app/api/meals/[id]/route";

it("serializes documents and lean values while retaining route envelopes", async () => {
  fixture.meal = {
    _id: new Types.ObjectId("507f1f77bcf86cd799439012"), userId: new Types.ObjectId("507f1f77bcf86cd799439011"),
    name: "Soup", date: "2024-02-29", type: "lunch", reaction: "good", extra: "discard",
    createdAt: new Date("2026-01-01Z"), updatedAt: new Date("2026-01-01Z"),
  };
  const listed = await (await list(new Request("http://localhost/api/meals"))).json();
  expect(listed[0]).toMatchObject({ id: "507f1f77bcf86cd799439012", date: "2024-02-29", user: "507f1f77bcf86cd799439011", createdAt: "2026-01-01T00:00:00.000Z" });
  const response = await detail(new Request("http://localhost/api/meals/id"), { params: Promise.resolve({ id: "507f1f77bcf86cd799439012" }) });
  expect(response.status).toBe(200);
  const { meal } = await response.json();
  expect(meal).not.toHaveProperty("extra");
  expect(meal.userId).toBe("507f1f77bcf86cd799439011");
});

const validMeal = { name: " Soup ", date: "2024-02-29", type: "lunch", reaction: "good" };
const post = (body: string, headers?: HeadersInit) => create(new Request("http://localhost/api/meals", {
  method: "POST", body, headers,
}));

it("returns the confirmed meal directly and assigns it to the authenticated account", async () => {
  const response = await post(JSON.stringify({ ...validMeal, userId: "507f1f77bcf86cd799439099" }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    id: "507f1f77bcf86cd799439012", user: "507f1f77bcf86cd799439011", name: "Soup", date: "2024-02-29",
  });
});

it.each([
  "{", "null", "[]", JSON.stringify({ ...validMeal, name: " " }),
  JSON.stringify({ ...validMeal, date: "2023-02-29" }),
  JSON.stringify({ ...validMeal, date: "2024-02-29T00:00:00Z" }),
  JSON.stringify({ ...validMeal, type: "tea" }),
  JSON.stringify({ ...validMeal, reaction: "unknown" }),
  JSON.stringify({ ...validMeal, notes: 9 }),
])("returns a public input error for an invalid creation body", async body => {
  const response = await post(body);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.any(String), code: "INVALID_INPUT" });
});

it("rejects creation from a foreign origin", async () => {
  const response = await post(JSON.stringify(validMeal), { origin: "https://foreign.example" });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "FORBIDDEN_ORIGIN" });
});

it.each([
  [new mongo.MongoNetworkError("internal network details"), 503, "PERSISTENCE_UNAVAILABLE"],
  [new Error("internal exception"), 500, "INTERNAL_ERROR"],
] as const)("maps storage failures to public errors", async (failure, status, code) => {
  for (const request of [
    () => post(JSON.stringify(validMeal)),
    () => list(new Request("http://localhost/api/meals")),
    () => detail(new Request("http://localhost/api/meals/id"), { params: Promise.resolve({ id: "507f1f77bcf86cd799439012" }) }),
  ]) {
    fixture.connect.mockRejectedValueOnce(failure);
    const response = await request();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: expect.any(String), code });
  }
});
