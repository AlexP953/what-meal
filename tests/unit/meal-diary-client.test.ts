import { afterEach, expect, it, vi } from "vitest";
import { diarySearch, formatMealDate, readDiary } from "@/app/meals/diary-client";
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
  expect(await readDiary("sortDir=asc", row.user, signal)).toEqual([{
    _id: row.id, userId: row.user, name: row.name, date: row.date, type: row.type, reaction: row.reaction,
    place: undefined, notes: undefined,
  }]);
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
