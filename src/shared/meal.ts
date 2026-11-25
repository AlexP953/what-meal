export const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;
export const mealReactions = ["good", "bad", "neutral"] as const;
export type MealType = typeof mealTypes[number];
export type MealReaction = typeof mealReactions[number];

export interface PublicMeal {
  _id: string;
  id: string;
  userId: string;
  name: string;
  date: string;
  type: MealType;
  reaction: MealReaction;
  place?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ListedMeal = Omit<PublicMeal, "_id" | "userId" | "place" | "notes"> & {
  user: string;
  place: string | null;
  notes: string | null;
};

export type EditedMeal = Omit<ListedMeal, "user" | "createdAt" | "updatedAt"> & { userId: string };

// Gregorian calendar arithmetic avoids Date's timezone and year-0-to-99 conversions.
export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
