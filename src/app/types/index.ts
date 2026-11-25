// Compatibility names for existing UI components. No server imports belong here.
import type { PublicMeal } from "@/shared/meal";
export type { PublicUser as UserLean } from "@/shared/user";
export type MealLean = Pick<PublicMeal, "_id" | "userId" | "name" | "date" | "type" | "reaction" | "place" | "notes">;
