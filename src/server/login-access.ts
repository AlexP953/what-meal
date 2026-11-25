import "server-only";
import { reserveAccess, completeLogin } from "@/server/access-limits";
import { authorizeCredentials } from "@/server/credentials";
import { emailSchema } from "@/lib/validations";

export class LoginLimitError extends Error {
  constructor(readonly retryAfter: number) { super("Login limit reached"); }
}

export async function limitedCredentials(credentials: Partial<Record<string, unknown>>) {
  const email = emailSchema.safeParse(credentials.email);
  if (!email.success || typeof credentials.password !== "string") return null;
  const reservation = await reserveAccess("login", email.data);
  if (!reservation.allowed) throw new LoginLimitError(reservation.retryAfter);
  const user = await authorizeCredentials(credentials);
  if (!await completeLogin(reservation, Boolean(user))) return null;
  return user;
}
