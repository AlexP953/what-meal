import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { authClient } from "../tests/helpers/app";
import { dbConnect } from "../src/server/persistence/connection";
import { Meal } from "../src/server/persistence/meal";
import { formatMealDate } from "../src/app/meals/diary-client";
import type { EditedMeal, ListedMeal, PublicMeal } from "../src/shared/meal";

const email = "diary-probe@example.com";
const password = "diary-verification-password";
const collection = "/api/meals";
const dish = { name: "Leap day", date: "2024-02-29", type: "lunch", reaction: "good", place: "Home", notes: "Keep" } as const;
const filters = "?type=lunch&reaction=good&reaction=bad&dateFrom=2024-02-29&dateTo=2024-03-01";

function body(method: string, value: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(value) };
}

async function expectJson<T>(response: Response, status: number): Promise<T> {
  assert.equal(response.status, status, `Expected HTTP ${status} for diary probe, received ${response.status}`);
  return response.json();
}

async function main() {
  const [mode, baseUrl, snapshotFile] = process.argv.slice(2);
  assert.ok(mode === "seed" || mode === "read");
  assert.ok(snapshotFile);
  assert.match(baseUrl ?? "", /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
  assert.match(process.env.MONGODB_URI ?? "", /^mongodb:\/\/127\.0\.0\.1:\d+$/);
  assert.match(process.env.MONGODB_DB ?? "", /^whatmeal_verify_[a-f0-9]{32}$/);

  const client = authClient(baseUrl);
  if (mode === "seed") {
    await expectJson(await client.request("/api/users", body("POST", { email, password })), 201);
  }
  await expectJson(await client.signIn(email, password), 200);
  const { user } = await expectJson<{ user: { id: string } }>(await client.request("/api/auth/session"), 200);
  assert.ok(user?.id);

  const create = async (fields: Partial<ListedMeal> = {}) =>
    expectJson<ListedMeal>(await client.request(collection, body("POST", { ...dish, ...fields })), 201);
  const detail = async (id: string) =>
    (await expectJson<{ meal: PublicMeal }>(await client.request(`${collection}/${id}`), 200)).meal;
  const list = async (search = "") => expectJson<ListedMeal[]>(await client.request(collection + search), 200);

  async function snapshot(ids: { leap: string; edited: string; legacy: string; deleted: string }) {
    const meals = await list();
    const ascending = await list(filters + "&sortDir=asc");
    const descending = await list(filters);
    const details = await Promise.all([ids.leap, ids.edited, ids.legacy].map(detail));
    const missing = await expectJson<{ code: string }>(await client.request(`${collection}/${ids.deleted}`), 404);

    assert.deepEqual(meals.map(meal => meal.id), [ids.edited, ids.leap, ids.legacy]);
    assert.ok(meals.every(meal => meal.user === user.id));
    assert.deepEqual(ascending.map(meal => meal.id), [ids.leap, ids.edited]);
    assert.deepEqual(descending.map(meal => meal.id), [ids.edited, ids.leap]);
    assert.deepEqual(details.map(meal => meal.userId), [user.id, user.id, user.id]);
    assert.equal(missing.code, "MEAL_NOT_FOUND");
    const displayDates = details.map(meal => formatMealDate(meal.date));
    assert.deepEqual(displayDates, ["29-02-2024", "01-03-2024", "28-02-2024"]);
    return { ids, meals, ascending, descending, details, displayDates };
  }

  if (mode === "seed") {
    let legacyId: string;
    try {
      await dbConnect();
      const legacy = await Meal.create({ ...dish, name: "Existing civil date", date: "2024-02-28", userId: user.id });
      legacyId = legacy.id;
    } finally {
      await mongoose.disconnect();
    }
    const leap = await create();
    const changed = await create({ name: "Before edit", date: "2024-03-02" });
    const { meal: edited } = await expectJson<{ meal: EditedMeal }>(await client.request(
      `${collection}/${changed.id}`,
      body("PATCH", { name: "After edit", date: "2024-03-01", reaction: "bad", place: "" }),
    ), 200);
    assert.equal(edited.id, changed.id);
    assert.equal(edited.userId, user.id);
    assert.equal(edited.date, "2024-03-01");
    assert.equal(edited.place, "");
    assert.equal(edited.notes, dish.notes);

    const deleted = await create({ name: "Removed", date: "2024-03-01" });
    await expectJson(await client.request(`${collection}/${deleted.id}`, { method: "DELETE" }), 200);
    const before = await snapshot({ leap: leap.id, edited: edited.id, legacy: legacyId, deleted: deleted.id });
    assert.equal(before.details[0].date, leap.date);
    assert.equal(before.details[1].name, edited.name);
    await writeFile(snapshotFile, JSON.stringify(before));
  } else {
    const before = JSON.parse(await readFile(snapshotFile, "utf8")) as Awaited<ReturnType<typeof snapshot>>;
    assert.deepEqual(await snapshot(before.ids), before);
  }
  console.log(`Authenticated diary probe ${mode} passed (${process.env.TZ ?? "default timezone"}).`);
}

void main().catch(error => {
  console.error("Isolated diary persistence probe failed.", error instanceof Error ? error.name : "Unknown failure");
  process.exitCode = 1;
});
