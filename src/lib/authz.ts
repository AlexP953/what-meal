import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { getAuthConfig } from "@/server/config";
import { verifySessionAccount } from "@/server/session-account";
import { validSessionClaims, SESSION_MAX_AGE } from "@/lib/session-claims";
import { apiError } from "@/server/http-errors";
import type { Session } from "next-auth";

export async function requireSession(): Promise<
  | { session: Session; error?: undefined }
  | { session?: undefined; error: NextResponse }
> {
  try {
    const requestHeaders = await headers();
    const secureCookie = /(?:^|;\s*)__Secure-authjs\.session-token(?:\.\d+)?=/.test(requestHeaders.get("cookie") ?? "");
    // Decode Auth.js' encrypted cookie, then authorize against the account without a request cache.
    // https://authjs.dev/reference/core/jwt#gettoken
    const token = await getToken({ req: { headers: requestHeaders }, secret: getAuthConfig().secret, secureCookie });
    if (!token || !validSessionClaims(token)) return { error: apiError(401, "UNAUTHORIZED", "Sesión no válida") };
    const account = await verifySessionAccount(token.uid, token.authVersion);
    if (account.status === "unavailable") return { error: apiError(503, "PERSISTENCE_UNAVAILABLE", "Servicio temporalmente no disponible") };
    if (account.status === "invalid") return { error: apiError(401, "UNAUTHORIZED", "Sesión no válida") };
    return { session: { user: account.user, expires: new Date(token.signedInAt! + SESSION_MAX_AGE * 1000).toISOString() } };
  } catch {
    return { error: apiError(503, "PERSISTENCE_UNAVAILABLE", "Servicio temporalmente no disponible") };
  }
}

export function isAdmin(session: Session | null | undefined) {
  return session?.user?.role === "admin";
}

export function forbid() {
  return apiError(403, "FORBIDDEN", "Permisos insuficientes");
}
