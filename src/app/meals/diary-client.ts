import type { ListedMeal, MealReaction, MealType } from "@/shared/meal";
import type { MealLean } from "../types";

type DiaryFilters = {
  type: MealType | "";
  reactions: MealReaction[];
  dateFrom: string;
  dateTo: string;
  sortDir: "asc" | "desc";
};

export function diarySearch({ type, reactions, dateFrom, dateTo, sortDir }: DiaryFilters) {
  const search = new URLSearchParams({ sortDir });
  if (type) search.set("type", type);
  for (const reaction of reactions) search.append("reaction", reaction);
  if (dateFrom) search.set("dateFrom", dateFrom);
  if (dateTo) search.set("dateTo", dateTo);
  return search;
}

export function toMealView({ id, user, name, date, type, reaction, place, notes }: ListedMeal): MealLean {
  return { _id: id, userId: user, name, date, type, reaction, place: place ?? undefined, notes: notes ?? undefined };
}

export async function readDiary(search: string, userId: string, signal: AbortSignal): Promise<MealLean[] | null> {
  const response = await fetch(`/api/meals?${search}`, { signal, cache: "no-store" });
  signal.throwIfAborted();
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudieron cargar las comidas");

  const meals: ListedMeal[] = await response.json();
  signal.throwIfAborted();
  // A cookie can change before the session provider reports the new account.
  if (meals.some(meal => meal.user !== userId)) return null;
  return meals.map(toMealView);
}

export function formatMealDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}
