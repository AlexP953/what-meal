import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireSession: async () => ({ session: { user: { id: "507f1f77bcf86cd799439011", role: "admin" } } }),
  isAdmin: () => true,
  forbid: () => Response.json({}, { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ dbConnect: async () => undefined }));
vi.mock("@/server/persistence/meal", async (importOriginal) => ({ ...await importOriginal<typeof import("@/server/persistence/meal")>(), Meal: { findById: async () => null } }));

import { PATCH } from "@/app/api/meals/[id]/route";
import { authConfig } from "@/lib/auth.config";

describe("framework consumers", () => {
  it("resolves dynamic params before looking for a meal", async () => {
    const response = await PATCH(new Request("http://localhost/api/meals/507f1f77bcf86cd799439011", { method: "PATCH" }), {
      params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Meal not found" });
  });

  it("preserves the existing JWT identity and role", async () => {
    const callback = authConfig.callbacks.jwt;
    const result = await callback({ token: {}, user: { id: "account", role: "admin" } } as Parameters<typeof callback>[0]);
    expect(result).toEqual({ uid: "account", role: "admin" });
  });
});
