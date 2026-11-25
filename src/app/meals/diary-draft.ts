import type { DiaryFilters, DiaryMeal } from "./diary-client";
import type { MealFieldValues } from "./mutation-client";

export type MealDraft = {
  kind: "meal";
  meal?: DiaryMeal;
  values: MealFieldValues;
  confirmDelete: boolean;
  uncertain: boolean;
};

export type DiaryDraft = MealDraft | { kind: "filters"; filters: DiaryFilters };
