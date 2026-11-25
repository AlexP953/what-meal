import "server-only";
import { Schema, model, models, type Model, type Types } from "mongoose";
import type { PublicUser, UserRole } from "@/shared/user";

export interface UserRecord {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  role: UserRole;
  fcmToken: string | null;
  createdAt: Date;
  updatedAt: Date;
  meals?: unknown[];
}

type PublicUserSource = Pick<UserRecord, "_id" | "email" | "name" | "role" | "createdAt" | "updatedAt">;

export function serializeUser(user: PublicUserSource): PublicUser {
  return {
    _id: user._id.toString(),
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

const userSchema = new Schema<UserRecord>({
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  name: String,
  role: { type: String, required: true, enum: ["admin", "user"], default: "user", index: true },
  fcmToken: { type: String, default: null, select: false },
}, { timestamps: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.virtual("meals", { ref: "Meal", localField: "_id", foreignField: "userId", justOne: false });
userSchema.set("toJSON", {
  virtuals: true,
  transform: (_document, user) => ({ ...serializeUser(user), ...(user.meals ? { meals: user.meals } : {}) }),
});

// Reuse the registered model during development reloads.
export const User: Model<UserRecord> = (models.User as Model<UserRecord> | undefined) ?? model<UserRecord>("User", userSchema);
