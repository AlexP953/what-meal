import { Types } from "mongoose";

export type UserLean = {
  _id: Types.ObjectId;
  passwordHash: string;
  email: string;
  name?: string;
  role: "admin" | "user";
};
