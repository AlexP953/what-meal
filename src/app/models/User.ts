import { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    role: { type: String, enum: ["admin", "user"], default: "user", index: true },
    fcmToken: { type: String, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } } // 👈
);

UserSchema.virtual("meals", {
  ref: "Meal",
  localField: "_id",
  foreignField: "userId",
  justOne: false,
});

export type UserDoc = {
  _id: string;
  email: string;
  passwordHash: string;
  name?: string;
  role: string;
  fcmToken?: string | null;
};

export const User = models.User || model("User", UserSchema);