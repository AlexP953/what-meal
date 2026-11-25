import { isCivilDate, type ListedMeal, type MealReaction, type MealType } from "@/shared/meal";

export type DiaryFilters = {
  type: MealType | "";
  reactions: readonly MealReaction[];
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

export const defaultDiaryFilters: DiaryFilters = {
  type: "", reactions: [], dateFrom: "", dateTo: "", sortDir: "desc",
};

export type DiaryMeal = Omit<ListedMeal, "updatedAt">;
export type DiaryChange = { meal: DiaryMeal } | { id: string };
export type DiarySnapshot = { meals: DiaryMeal[]; filters: DiaryFilters };

export function dateRangeError(from: string, to: string) {
  if ((from && !isCivilDate(from)) || (to && !isCivilDate(to))) {
    return "Introduce fechas válidas en formato YYYY-MM-DD.";
  }
  return from && to && from > to ? "La fecha Desde debe ser anterior o igual a Hasta." : "";
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function applyDiaryChange(meals: DiaryMeal[], filters: DiaryFilters, change: DiaryChange) {
  const id = "meal" in change ? change.meal.id : change.id;
  const candidates = meals.filter(meal => meal.id !== id);
  if ("meal" in change) candidates.push(change.meal);

  const { type, reactions, dateFrom, dateTo, sortDir } = filters;
  const dateDirection = sortDir === "asc" ? 1 : -1;
  return candidates.filter(meal =>
    (!type || meal.type === type) &&
    (!reactions.length || reactions.includes(meal.reaction)) &&
    (!dateFrom || meal.date >= dateFrom) &&
    (!dateTo || meal.date <= dateTo)
  ).sort((a, b) =>
    dateDirection * compareText(a.date, b.date) ||
    compareText(b.createdAt, a.createdAt) ||
    compareText(b.id, a.id)
  );
}

export function isDiarySessionLost(response: Response) {
  return response.status === 401 || response.status === 409;
}

export async function readDiary(filters: DiaryFilters, userId: string, signal: AbortSignal): Promise<DiarySnapshot | null> {
  const response = await fetch(`/api/meals?${diarySearch(filters)}`, { signal, cache: "no-store" });
  signal.throwIfAborted();
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudieron cargar las comidas");

  const meals: ListedMeal[] = await response.json();
  signal.throwIfAborted();
  // A cookie can change before the session provider reports the new account.
  if (meals.some(meal => meal.user !== userId)) return null;
  return { filters, meals };
}

export function formatMealDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}

export function watchDiaryExpiry(expiresAt: number, onExpire: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  function stop() {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
  }

  function check() {
    clearTimeout(timer);
    const remaining = expiresAt - Date.now();
    if (!(remaining > 0)) {
      stop();
      onExpire();
      return;
    }
    timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
  }

  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  check();
  return stop;
}
