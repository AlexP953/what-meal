import { Types } from "mongoose";

export type UserLean = {
  _id: Types.ObjectId;
  passwordHash: string;
  email: string;
  name?: string;
  role: "admin" | "user";
};

export type MealLean = {
  _id: string;
  name: string;
  date: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  reaction: "good" | "bad" | "neutral";
  userId: string,
  place?: string;
  notes?: string;
};
