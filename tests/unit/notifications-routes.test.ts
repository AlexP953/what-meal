import { expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ dbConnect: () => { throw new Error("Database must not connect"); } }));
vi.mock("firebase-admin/app", () => { throw new Error("Firebase Admin must not load"); });
import { POST as register } from "@/app/api/register-push-token/route";
import { POST as send } from "@/app/api/send-notification/route";
import { POST as token, DELETE as remove } from "@/app/api/users/[id]/token/route";

it("returns controlled unavailable responses before parsing input or accessing services", async () => {
  const request = new Request("http://localhost/api", { method: "POST", body: "invalid-json" });
  const context = { params: Promise.resolve({ id: "invalid" }) };
  for (const response of [await register(request), await send(request), await token(request, context), await remove(request, context)]) {
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "NOTIFICATIONS_DISABLED" });
  }
});
