import { afterEach, expect, it, vi } from "vitest";
import { holdDiaryLock, postAuth, readSession } from "@/app/session-client";

afterEach(() => vi.unstubAllGlobals());

it("invalidates other tabs before posting credentials even when the response is lost", async () => {
  const channel = { postMessage: vi.fn(), close: vi.fn() };
  vi.stubGlobal("BroadcastChannel", vi.fn(function () { return channel; }));
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
  const lost = new TypeError("Connection lost");
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "test-csrf" }))
    .mockImplementationOnce(() => {
      expect(channel.postMessage).toHaveBeenCalledTimes(1);
      return Promise.reject(lost);
    }));
  await expect(postAuth("callback/credentials", new URLSearchParams())).rejects.toBe(lost);
  expect(channel.postMessage).toHaveBeenCalledTimes(2);
});

it("distinguishes temporary session verification failure from an absent cookie", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json(null))
    .mockResolvedValueOnce(Response.json({ code: "PERSISTENCE_UNAVAILABLE" }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({
      user: { id: "account-1" }, expires: "2099-01-01T00:00:00Z",
    })));
  const { signal } = new AbortController();
  await expect(readSession(signal)).resolves.toEqual({ status: "absent" });
  await expect(readSession(signal)).resolves.toEqual({ status: "unavailable" });
  await expect(readSession(signal)).resolves.toEqual({
    status: "verified", userId: "account-1", expiresAt: Date.parse("2099-01-01T00:00:00Z"),
  });
});

it("waits for the diary to release its lock before posting a cookie change", async () => {
  const holding = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const controller = new AbortController();
  const diary = holdDiaryLock(controller.signal, async () => {
    holding.resolve();
    await released.promise;
  });
  await holding.promise;

  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "test-csrf" }))
    .mockResolvedValueOnce(Response.json({ url: "http://localhost/login" }));
  vi.stubGlobal("fetch", fetcher);
  const signOut = postAuth("signout", new URLSearchParams());
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    released.resolve();
    await diary;
  }
  await expect(signOut).resolves.toMatchObject({ status: 200 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("keeps the diary closed when the browser cannot coordinate cookie changes", async () => {
  vi.stubGlobal("navigator", {});
  const work = vi.fn();
  await expect(holdDiaryLock(new AbortController().signal, work)).rejects.toThrow("Web Locks unavailable");
  expect(work).not.toHaveBeenCalled();
});
