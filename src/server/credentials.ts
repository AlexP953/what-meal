import "server-only";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/server/persistence/user";
import { emailSchema } from "@/lib/validations";

export async function authorizeCredentials(credentials: Partial<Record<string, unknown>>) {
  const email = emailSchema.safeParse(credentials.email);
  if (!email.success || typeof credentials.password !== "string" || !credentials.password) return null;
  await dbConnect();
  const user = await User.findOne({ email: email.data }).select("+passwordHash +authVersion").lean();
  if (!user) return null;
  // Carry the version from the same snapshot as the verified hash, including during password races.
  const version = user.authVersion === undefined ? 0 : user.authVersion;
  if (!Number.isSafeInteger(version) || version < 0 || !["admin", "user"].includes(user.role)) return null;
  if (!await bcrypt.compare(credentials.password, user.passwordHash)) return null;
  return { id: String(user._id), email: user.email, name: user.name ?? null, role: user.role, authVersion: version };
}
