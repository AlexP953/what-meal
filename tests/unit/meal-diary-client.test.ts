import { afterEach, expect, it, vi } from "vitest";
import { applyDiaryChange, dateRangeError, defaultDiaryFilters, diarySearch, formatMealDate, readDiary, watchDiaryExpiry } from "@/app/meals/diary-client";
import type { ListedMeal } from "@/shared/meal";

const row: ListedMeal = {
  id: "meal-1", user: "account-1", name: "Soup", date: "2024-02-29", type: "lunch", reaction: "good",
  place: null, notes: null, createdAt: "2024-02-29T00:00:00Z", updatedAt: "2024-02-29T00:00:00Z",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("encodes each filter and restores descending order on reset", () => {
  expect([...diarySearch({
    type: "lunch", reactions: ["bad", "good"], dateFrom: "2024-02-29", dateTo: "", sortDir: "asc",
  })]).toEqual([["sortDir", "asc"], ["type", "lunch"], ["reaction", "bad"], ["reaction", "good"], ["dateFrom", "2024-02-29"]]);
  expect([...diarySearch({ type: "", reactions: [], dateFrom: "", dateTo: "", sortDir: "desc" })]).toEqual([["sortDir", "desc"]]);
});

it("reads the confirmed rows with their server identities and civil dates", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json([row]));
  vi.stubGlobal("fetch", fetch);
  const { signal } = new AbortController();
  expect(await readDiary({ ...defaultDiaryFilters, sortDir: "asc" }, row.user, signal)).toEqual({
    filters: { ...defaultDiaryFilters, sortDir: "asc" }, meals: [row],
  });
  expect(fetch).toHaveBeenCalledWith("/api/meals?sortDir=asc", { signal, cache: "no-store" });
  expect(formatMealDate(row.date)).toBe("29-02-2024");
});

it("discards expired sessions and results from a different account", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json([row])));
  const { signal } = new AbortController();
  expect(await readDiary(defaultDiaryFilters, row.user, signal)).toBeNull();
  expect(await readDiary(defaultDiaryFilters, "account-2", signal)).toBeNull();
});

it("discards a delayed result when its filter or account is replaced", async () => {
  const response = Promise.withResolvers<Response>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
  const controller = new AbortController();
  const result = readDiary({ ...defaultDiaryFilters, sortDir: "asc" }, row.user, controller.signal);
  controller.abort();
  response.resolve(Response.json([row]));
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
});

it("keeps confirmed changes when reloading fails and respects the active filters", async () => {
  const filters = { type: "lunch", reactions: ["good", "bad"], dateFrom: row.date, dateTo: row.date, sortDir: "asc" } as const;
  const added: ListedMeal = { ...row, id: "meal-3", name: "Salad" };
  const older: ListedMeal = { ...row, id: "meal-4", createdAt: "2024-02-28T00:00:00Z" };
  let visible = applyDiaryChange([row, older], filters, { meal: added });
  expect(visible.map(meal => meal.id)).toEqual([added.id, row.id, older.id]);

  const edited = { ...added, date: "2024-03-01" };
  visible = applyDiaryChange(visible, filters, { meal: edited });
  expect(visible.map(meal => meal.id)).toEqual([row.id, older.id]);
  visible = applyDiaryChange(visible, filters, { meal: { ...edited, date: row.date, reaction: "bad" } });
  expect(visible[0]).toMatchObject({ id: added.id, reaction: "bad" });
  visible = applyDiaryChange(visible, filters, { id: row.id });

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(readDiary({ ...defaultDiaryFilters, sortDir: "asc" }, row.user, new AbortController().signal)).rejects.toThrow();
  expect(visible.map(meal => meal.id)).toEqual([added.id, older.id]);
});

it("identifies invalid date drafts while accepting equal and one-sided bounds", () => {
  expect(dateRangeError("2024-03-01", "2024-02-29")).toMatch(/Desde.*Hasta/);
  expect(dateRangeError("10000-01-01", "")).toMatch(/YYYY-MM-DD/);
  expect(dateRangeError("2024-02-29", "2024-02-29")).toBe("");
  expect(dateRangeError("", "2024-02-29")).toBe("");
});

it("reconciles a mutation against the last successful filters and retries the pending filters", async () => {
  const confirmedFilters = { ...defaultDiaryFilters, type: "lunch" } as const;
  const requestedFilters = { ...defaultDiaryFilters, type: "dinner" } as const;
  const dinner = { ...row, id: "meal-2", type: "dinner" } as const;
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json([row]))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json([dinner]));
  vi.stubGlobal("fetch", fetch);
  const { signal } = new AbortController();
  const confirmed = await readDiary(confirmedFilters, row.user, signal);
  expect(confirmed).toEqual({ filters: confirmedFilters, meals: [row] });
  await expect(readDiary(requestedFilters, row.user, signal)).rejects.toThrow();

  const newLunch = { ...row, id: "meal-3" };
  expect(applyDiaryChange(confirmed!.meals, confirmed!.filters, { meal: newLunch }))
    .toEqual([newLunch, row]);
  expect(await readDiary(requestedFilters, row.user, signal)).toEqual({ filters: requestedFilters, meals: [dinner] });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "/api/meals?sortDir=desc&type=lunch", "/api/meals?sortDir=desc&type=dinner", "/api/meals?sortDir=desc&type=dinner",
  ]);
});

it("expires an inactive diary at its deadline, even with a response still pending", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", new EventTarget());
  const controller = new AbortController();
  const expire = vi.fn(() => controller.abort());
  const response = Promise.withResolvers<Response>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
  const stop = watchDiaryExpiry(Date.now() + 1_000, expire);
  try {
    const pending = readDiary(defaultDiaryFilters, row.user, controller.signal);
    vi.advanceTimersByTime(999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledTimes(1);
    response.resolve(Response.json([row]));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  } finally {
    stop();
  }
});

it("checks expiry on return from suspension and removes the previous session watcher", () => {
  vi.useFakeTimers();
  const tab = new EventTarget();
  vi.stubGlobal("window", tab);
  vi.stubGlobal("document", new EventTarget());
  const deadline = Date.now() + 1_000;
  const old = vi.fn();
  watchDiaryExpiry(deadline, old)();
  const expire = vi.fn();
  const stop = watchDiaryExpiry(deadline, expire);
  try {
    vi.setSystemTime(deadline);
    tab.dispatchEvent(new Event("pageshow"));
    tab.dispatchEvent(new Event("focus"));
    expect(expire).toHaveBeenCalledTimes(1);
    expect(old).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});
