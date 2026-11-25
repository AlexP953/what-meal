import { EXPECTED_MEAL_ACCOUNT_HEADER, isCivilDate, mealReactions, mealTypes, type MealReaction, type MealType } from "@/shared/meal";
import { isDiarySessionLost, type DiaryChange, type DiaryMeal } from "./diary-client";

type MealFields = {
  name: string;
  date: string;
  type: MealType;
  reaction: MealReaction;
  place: string;
  notes: string;
};

type MealOperation = { method: "POST"; fields: MealFields };

type MutationResult =
  | { status: "confirmed"; change: DiaryChange }
  | { status: "rejected"; error: string }
  | { status: "session-lost" | "uncertain" | "aborted" };

function isMealFields(value: Partial<MealFields>) {
  return typeof value.name === "string" && Boolean(value.name.trim()) &&
    typeof value.date === "string" && isCivilDate(value.date) &&
    value.type !== undefined && mealTypes.includes(value.type) &&
    value.reaction !== undefined && mealReactions.includes(value.reaction) &&
    (value.place === null || typeof value.place === "string") &&
    (value.notes === null || typeof value.notes === "string");
}

export async function mutateMeal(operation: MealOperation, userId: string, signal: AbortSignal): Promise<MutationResult> {
  try {
    const response = await fetch("/api/meals", {
      method: operation.method,
      headers: { "Content-Type": "application/json", [EXPECTED_MEAL_ACCOUNT_HEADER]: userId },
      body: JSON.stringify({
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

export function readMealFields(form: HTMLFormElement): MealFields {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? "").trim(),
    date: String(data.get("date") ?? ""),
    type: data.get("type") as MealType,
    reaction: data.get("reaction") as MealReaction,
    place: String(data.get("place") ?? "").trim(),
    notes: String(data.get("notes") ?? "").trim(),
  };
}
