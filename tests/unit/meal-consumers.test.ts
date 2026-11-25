import { expect, it, vi } from "vitest";
import { Types } from "mongoose";
const fixture = vi.hoisted(() => ({ meal: {} as Record<string, unknown> }));
vi.mock("@/lib/authz", () => ({
  requireSession: async () => ({ session: { user: { id: "507f1f77bcf86cd799439011", role: "admin" } } }),
  isAdmin: () => true,
  forbid: () => Response.json({}, { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ dbConnect: async () => undefined }));
vi.mock("@/server/persistence/meal", async (importOriginal) => ({ ...await importOriginal<typeof import("@/server/persistence/meal")>(), Meal: {
  find: () => ({ sort: () => ({ lean: async () => [fixture.meal] }) }),
  findById: async () => fixture.meal,
} }));
import { GET as list } from "@/app/api/meals/route";
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
