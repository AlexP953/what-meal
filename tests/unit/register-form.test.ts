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
it.each([400, 429, 503])("makes HTTP %s errors understandable", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  expect(await submitRegistration(form())).toEqual({ ok: false, error: expect.any(String) });
});
it("recovers from network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect(await submitRegistration(form())).toEqual({ ok: false, error: expect.stringContaining("conexión") });
});

it("identifies an existing account so the form can offer sign-in", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 409 })));
  expect(await submitRegistration(form())).toMatchObject({ ok: false, duplicate: true });
});

it("associates passwords over the byte limit with their field before sending", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const data = form();
  data.set("password", "🌱".repeat(19));
  expect(await submitRegistration(data)).toMatchObject({ ok: false, field: "password" });
  expect(fetcher).not.toHaveBeenCalled();
});
