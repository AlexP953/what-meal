import type { MealReaction, MealType } from "@/shared/meal";

export const typeLabels: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  dinner: "Cena",
  snack: "Snack",
};

export const reactionLabels: Record<MealReaction, string> = {
  good: "Bien",
  neutral: "Neutral",
  bad: "Mal",
};
