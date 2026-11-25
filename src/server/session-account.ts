import "server-only";
import { dbConnect } from "@/server/persistence/connection";
import { User } from "@/server/persistence/user";
import type { UserRole } from "@/shared/user";

type AccountIdentity = { id: string; email: string; name: string | null; role: UserRole };
type AccountCheck = { status: "valid"; user: AccountIdentity } | { status: "invalid" } | { status: "unavailable" };

export async function verifySessionAccount(id: unknown, version: unknown): Promise<AccountCheck> {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id) || !Number.isSafeInteger(version) || (version as number) < 0) return { status: "invalid" };
  try {
    await dbConnect();
    const user = await User.findById(id).select("email name role +authVersion").lean();
    if (!user || (user.authVersion === undefined ? 0 : user.authVersion) !== version || !["user", "admin"].includes(user.role)) return { status: "invalid" };
    return { status: "valid", user: { id: String(user._id), email: user.email, name: user.name ?? null, role: user.role } };
  } catch {
    return { status: "unavailable" };
  }
}
