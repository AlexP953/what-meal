import { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      index: true,
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", function (next) {
  // @ts-ignore
  if (this.email) this.email = String(this.email).toLowerCase().trim();
  next();
});

export type UserDoc = {
  _id: string;
  email: string;
  passwordHash: string;
  name?: string;
  role:string;
};

export const User = models.User || model("User", UserSchema);
