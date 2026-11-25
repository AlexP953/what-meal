import { afterEach, expect, it, vi } from "vitest";
import { applyDiaryChange, dateRangeError, diarySearch, formatMealDate, readDiary } from "@/app/meals/diary-client";
import type { ListedMeal } from "@/shared/meal";

const row: ListedMeal = {
  id: "meal-1", user: "account-1", name: "Soup", date: "2024-02-29", type: "lunch", reaction: "good",
  place: null, notes: null, createdAt: "2024-02-29T00:00:00Z", updatedAt: "2024-02-29T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

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
  expect(await readDiary("sortDir=asc", row.user, signal)).toEqual([row]);
  expect(fetch).toHaveBeenCalledWith("/api/meals?sortDir=asc", { signal, cache: "no-store" });
  expect(formatMealDate(row.date)).toBe("29-02-2024");
});

it("discards expired sessions and results from a different account", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json([row])));
  const { signal } = new AbortController();
  expect(await readDiary("", row.user, signal)).toBeNull();
  expect(await readDiary("", "account-2", signal)).toBeNull();
});

it("discards a delayed result when its filter or account is replaced", async () => {
  const response = Promise.withResolvers<Response>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
  const controller = new AbortController();
  const result = readDiary("sortDir=asc", row.user, controller.signal);
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
  await expect(readDiary("sortDir=asc", row.user, new AbortController().signal)).rejects.toThrow();
  expect(visible.map(meal => meal.id)).toEqual([added.id, older.id]);
});

it("identifies invalid date drafts while accepting equal and one-sided bounds", () => {
  expect(dateRangeError("2024-03-01", "2024-02-29")).toMatch(/Desde.*Hasta/);
  expect(dateRangeError("10000-01-01", "")).toMatch(/YYYY-MM-DD/);
  expect(dateRangeError("2024-02-29", "2024-02-29")).toBe("");
  expect(dateRangeError("", "2024-02-29")).toBe("");
});
