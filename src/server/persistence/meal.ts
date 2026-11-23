import "server-only";
import { Schema, model, models, type Model, type Types } from "mongoose";
import { isCivilDate, mealTypes, mealReactions, type MealType, type MealReaction, type PublicMeal } from "@/shared/meal";

export interface MealRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  date: string;
  type: MealType;
  reaction: MealReaction;
  place?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeMeal(meal: MealRecord): PublicMeal {
  return {
    _id: meal._id.toString(), id: meal._id.toString(), userId: meal.userId.toString(),
    name: meal.name, date: meal.date, type: meal.type, reaction: meal.reaction,
    place: meal.place, notes: meal.notes,
    createdAt: meal.createdAt.toISOString(), updatedAt: meal.updatedAt.toISOString(),
  };
}

const mealSchema = new Schema<MealRecord>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  date: { type: String, required: true, validate: { validator: isCivilDate, message: "Expected a valid YYYY-MM-DD civil date" }, index: true },
  type: { type: String, required: true, enum: mealTypes, index: true },
  reaction: { type: String, required: true, enum: mealReactions, index: true },
  place: { type: String, trim: true },
  notes: { type: String, trim: true },
}, { timestamps: true });
mealSchema.index({ userId: 1, date: -1 });
mealSchema.index({ userId: 1, type: 1 });
mealSchema.index({ userId: 1, reaction: 1 });
mealSchema.set("toJSON", { transform: (_document, meal) => serializeMeal(meal) });
export const Meal: Model<MealRecord> = (models.Meal as Model<MealRecord> | undefined) ?? model<MealRecord>("Meal", mealSchema);
