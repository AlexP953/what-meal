import { afterEach, expect, it, vi } from "vitest";
import { mutateMeal } from "@/app/meals/mutation-client";

const meal = {
  id: "meal-1", user: "account-1", name: "Ensalada", date: "2024-02-29",
  type: "lunch", reaction: "good", place: null, notes: null,
  createdAt: "2024-02-29T12:00:00Z", updatedAt: "2024-02-29T12:00:00Z",
};
const operation = { method: "POST", fields: { name: meal.name, date: meal.date, type: "lunch", reaction: "good", place: "", notes: "" } } as const;

afterEach(() => vi.unstubAllGlobals());

it("confirms a complete 201 response for the expected account", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(meal, { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const { signal } = new AbortController();
  await expect(mutateMeal(operation, meal.user, signal)).resolves.toEqual({ status: "confirmed", change: { meal } });
  expect(fetcher).toHaveBeenCalledWith("/api/meals", expect.objectContaining({
    method: "POST", headers: expect.objectContaining({ "X-Expected-Account": meal.user }), signal,
  }));
});

it.each([{ ...meal, name: undefined }, { ...meal, date: "2024-02-30" }])("treats an incomplete success as uncertain", async body => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, { status: 201 })));
  await expect(mutateMeal(operation, meal.user, new AbortController().signal)).resolves.toEqual({ status: "uncertain" });
});

it("fails closed if the response belongs to another account", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...meal, user: "other" }, { status: 201 })));
  await expect(mutateMeal(operation, meal.user, new AbortController().signal)).resolves.toEqual({ status: "session-lost" });
});

it("distinguishes a rejected form from a lost response", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ error: "Completa el nombre" }, { status: 400 }))
    .mockRejectedValueOnce(new TypeError("connection lost")));
  const { signal } = new AbortController();
  await expect(mutateMeal(operation, meal.user, signal)).resolves.toEqual({ status: "rejected", error: "Completa el nombre" });
  await expect(mutateMeal(operation, meal.user, signal)).resolves.toEqual({ status: "uncertain" });
});

it("validates edited meal identity and retains its original creation timestamp", async () => {
  const { user, createdAt } = meal;
  const fields = { id: meal.id, date: meal.date, type: meal.type, reaction: meal.reaction };
  const edited = { ...fields, userId: user, name: "Tostada", place: null, notes: null };
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ meal: { ...edited, id: "another-meal" } }))
    .mockResolvedValueOnce(Response.json({ meal: edited }));
  vi.stubGlobal("fetch", fetcher);
  const edit = { method: "PATCH", meal: { ...meal, type: "lunch", reaction: "good" }, fields: { ...operation.fields, place: "", notes: "" } } as const;
  const { signal } = new AbortController();
  await expect(mutateMeal(edit, user, signal)).resolves.toEqual({ status: "uncertain" });
  await expect(mutateMeal(edit, user, signal)).resolves.toMatchObject({
    status: "confirmed", change: { meal: { id: meal.id, name: "Tostada", user, createdAt } },
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ place: "", notes: "" });
});

it("confirms deletion only after receiving the expected successful response", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({ message: "Meal eliminado" }));
  vi.stubGlobal("fetch", fetcher);
  const operation = { method: "DELETE", meal: { ...meal, type: "lunch", reaction: "good" } } as const;
  const { signal } = new AbortController();
  await expect(mutateMeal(operation, meal.user, signal)).resolves.toEqual({ status: "uncertain" });
  await expect(mutateMeal(operation, meal.user, signal)).resolves.toEqual({ status: "confirmed", change: { id: meal.id } });
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "DELETE", headers: { "X-Expected-Account": meal.user } });
});
