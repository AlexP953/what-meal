import "server-only";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/server/persistence/user";
import { emailSchema } from "@/lib/validations";

// Disposable bcrypt hash at the current registration cost for absent accounts.
const missingAccountHash = "$2b$12$3PjZrMXK8gwTrSm8IzV9YeU5zksbjiDgmG3xphlm2nVVdrnhdV6cS";

export async function authorizeCredentials(credentials: Partial<Record<string, unknown>>) {
  const email = emailSchema.safeParse(credentials.email);
  if (!email.success || typeof credentials.password !== "string" || !credentials.password) return null;
  await dbConnect();
  const user = await User.findOne({ email: email.data }).select("+passwordHash +authVersion").lean();
  const matches = await bcrypt.compare(credentials.password, user?.passwordHash ?? missingAccountHash);
  if (!matches || !user) return null;
  // Carry the version from the same snapshot as the verified hash, including during password races.
  const version = user.authVersion === undefined ? 0 : user.authVersion;
  if (!Number.isSafeInteger(version) || version < 0 || !["admin", "user"].includes(user.role)) return null;
  return { id: String(user._id), email: user.email, name: user.name ?? null, role: user.role, authVersion: version };
}
