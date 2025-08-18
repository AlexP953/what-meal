import { Schema, models, model, Types } from "mongoose";

const MealSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"],
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      index: true,
    },
    reaction: {
      type: String,
      required: true,
      enum: ["good", "bad", "neutral"],
      index: true,
    },
    place: { type: String, trim: true },
    notes: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

MealSchema.index({ userId: 1, date: -1 });
MealSchema.index({ userId: 1, type: 1 });
MealSchema.index({ userId: 1, reaction: 1 });

export type MealDoc = {
  _id: Types.ObjectId;
  name: string;
  date: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  reaction: "good" | "bad" | "neutral";
  place?: string;
  notes?: string;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Meal = models.Meal || model("Meal", MealSchema);
