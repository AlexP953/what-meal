import { EXPECTED_MEAL_ACCOUNT_HEADER, isCivilDate, mealReactions, mealTypes, type MealReaction, type MealType } from "@/shared/meal";
import { isDiarySessionLost, type DiaryChange, type DiaryMeal } from "./diary-client";

export type MealFieldValues = {
  name: string;
  date: string;
  type: MealType;
  reaction: MealReaction;
  place: string;
  notes: string;
};

type MealOperation =
  | { method: "POST"; fields: MealFieldValues }
  | { method: "PATCH"; fields: MealFieldValues; meal: DiaryMeal }
  | { method: "DELETE"; meal: DiaryMeal };

type MutationResult =
  | { status: "confirmed"; change: DiaryChange }
  | { status: "rejected"; error: string }
  | { status: "session-lost" | "uncertain" | "aborted" };

function isMealFields(value: Partial<Omit<MealFieldValues, "place" | "notes"> & { place: string | null; notes: string | null }>) {
  return typeof value.name === "string" && Boolean(value.name.trim()) &&
    typeof value.date === "string" && isCivilDate(value.date) &&
    value.type !== undefined && mealTypes.includes(value.type) &&
    value.reaction !== undefined && mealReactions.includes(value.reaction) &&
    (value.place === null || typeof value.place === "string") &&
    (value.notes === null || typeof value.notes === "string");
}

export async function mutateMeal(operation: MealOperation, userId: string, signal: AbortSignal): Promise<MutationResult> {
  try {
    const path = operation.method === "POST" ? "/api/meals" : `/api/meals/${encodeURIComponent(operation.meal.id)}`;
    const headers = { [EXPECTED_MEAL_ACCOUNT_HEADER]: userId };
    const response = await fetch(path, {
      method: operation.method,
      headers: operation.method === "DELETE" ? headers : { ...headers, "Content-Type": "application/json" },
      body: operation.method === "DELETE" ? undefined : JSON.stringify(operation.method === "PATCH" ? operation.fields : {
        ...operation.fields,
        place: operation.fields.place || undefined,
        notes: operation.fields.notes || undefined,
      }),
      signal,
    });
    signal.throwIfAborted();
    if (isDiarySessionLost(response)) return { status: "session-lost" };

    const body = await response.json().catch(() => null);
    signal.throwIfAborted();

    if (response.status >= 400 && response.status < 500) return {
      status: "rejected",
      error: typeof body?.error === "string" ? body.error : "No se pudo guardar la comida. Comprueba los datos e inténtalo de nuevo.",
    };

    if (operation.method === "DELETE") {
      if (response.status !== 200 || body?.message !== "Meal eliminado") {
        return { status: "uncertain" };
      }
      return { status: "confirmed", change: { id: operation.meal.id } };
    }
    if (operation.method === "PATCH") {
      const updated = body?.meal;
      if (response.status !== 200 || !updated) return { status: "uncertain" };
      if (typeof updated.userId === "string" && updated.userId !== userId) return { status: "session-lost" };
      if (updated.userId !== userId || updated.id !== operation.meal.id || !isMealFields(updated)) {
        return { status: "uncertain" };
      }
      const { userId: owner, ...fields } = updated;
      return { status: "confirmed", change: { meal: { ...fields, user: owner, createdAt: operation.meal.createdAt } } };
    }

    if (response.status !== 201 || !body) return { status: "uncertain" };
    if (typeof body.user === "string" && body.user !== userId) return { status: "session-lost" };
    if (body.user !== userId || typeof body.id !== "string" || !body.id ||
        typeof body.createdAt !== "string" || !Number.isFinite(Date.parse(body.createdAt)) || !isMealFields(body)) {
      return { status: "uncertain" };
    }

    return { status: "confirmed", change: { meal: body as DiaryMeal } };
  } catch {
    return { status: signal.aborted ? "aborted" : "uncertain" };
  }
}

export function readMealDraft(form: HTMLFormElement): MealFieldValues {
  const value = (name: keyof MealFieldValues) =>
    (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";
  return {
    name: value("name"),
    date: value("date"),
    type: value("type") as MealType,
    reaction: value("reaction") as MealReaction,
    place: value("place"),
    notes: value("notes"),
  };
}

export function readMealFields(form: HTMLFormElement): MealFieldValues {
  const values = readMealDraft(form);
  return { ...values, name: values.name.trim(), place: values.place.trim(), notes: values.notes.trim() };
}
