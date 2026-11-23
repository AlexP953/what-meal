import { expect, it, vi } from "vitest";
import { Types } from "mongoose";
const fixture = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock("@/lib/authz", () => ({
  requireSession: async () => ({ session: { user: { id: "507f1f77bcf86cd799439011", role: "admin" } } }),
  isAdmin: () => true,
  forbid: () => Response.json({}, { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ dbConnect: async () => undefined }));
vi.mock("@/server/persistence/user", async (importOriginal) => ({ ...await importOriginal<typeof import("@/server/persistence/user")>(), User: {
  find: () => ({ select: () => ({ lean: async () => [fixture.user] }) }),
  findById: () => ({ select: () => ({ populate: async () => fixture.user }) }),
} }));
import { GET as list } from "@/app/api/users/route";
import { GET as detail } from "@/app/api/users/[id]/route";

it("uses explicit public serialization even when queries return private fields", async () => {
  fixture.user = {
    _id: new Types.ObjectId("507f1f77bcf86cd799439011"), email: "public@example.com", role: "user",
    passwordHash: "secret-hash", fcmToken: "secret-token", createdAt: new Date("2026-01-01Z"), updatedAt: new Date("2026-01-01Z"), meals: [],
  };
  for (const response of [await list(), await detail(new Request("http://localhost/api/users/id"), { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) })]) {
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(/passwordHash|fcmToken|secret-hash|secret-token/);
  }
});
