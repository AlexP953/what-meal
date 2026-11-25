import { afterEach, expect, it, vi } from "vitest";
import { submitLogin } from "@/app/login/submit";

afterEach(() => vi.unstubAllGlobals());

const form = new FormData();
form.set("email", "a@example.com");
form.set("password", "legacy");

it("sends the existing password and CSRF token to the protected diary entry", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "test-csrf" }))
    .mockResolvedValueOnce(Response.json({ url: "http://localhost/meals" }));
  vi.stubGlobal("fetch", fetcher);
  await expect(submitLogin(form)).resolves.toBe("ok");
  expect(fetcher.mock.calls[1][0]).toBe("/api/auth/callback/credentials");
  expect(Object.fromEntries(fetcher.mock.calls[1][1].body)).toEqual({
    email: "a@example.com", password: "legacy", csrfToken: "test-csrf", callbackUrl: "/meals",
  });
});

it("does not post credentials when the CSRF endpoint is unavailable", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(submitLogin(form)).resolves.toBe("service");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
