import { afterEach, expect, it, vi } from "vitest";
import { submitRegistration } from "@/app/register/submit";
afterEach(() => vi.unstubAllGlobals());
const form = () => { const data = new FormData(); data.set("email", "a@example.com"); data.set("password", "123456789012"); data.set("name", " "); return data; };
it("posts registration without an empty optional name or role", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await submitRegistration(form())).toEqual({ ok: true });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: "a@example.com", password: "123456789012" });
});
it.each([400, 409, 429, 503])("makes HTTP %s errors understandable", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  expect(await submitRegistration(form())).toEqual({ ok: false, error: expect.any(String) });
});
it("recovers from network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect(await submitRegistration(form())).toEqual({ ok: false, error: expect.stringContaining("conexión") });
});
