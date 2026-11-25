import type { JWT } from "next-auth/jwt";
export const SESSION_MAX_AGE = 24 * 60 * 60;

export function validSessionClaims(token: JWT, now = Date.now()): boolean {
  return typeof token.uid === "string" && Number.isSafeInteger(token.authVersion) && (token.authVersion as number) >= 0
    && Number.isSafeInteger(token.signedInAt) && (token.signedInAt as number) <= now
    && now - (token.signedInAt as number) < SESSION_MAX_AGE * 1000;
}
