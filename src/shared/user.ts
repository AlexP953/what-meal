export type UserRole = "admin" | "user";

export interface PublicUser {
  _id: string;
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}
