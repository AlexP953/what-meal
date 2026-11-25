import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthConfig } from "@/server/config";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { limitedCredentials, LoginLimitError } from "@/server/login-access";
import { verifySessionAccount } from "@/server/session-account";
import { applicationOrigin } from "@/server/request-origin";
import { apiError } from "@/server/http-errors";

class AccessUnavailable extends CredentialsSignin { code = "persistence_unavailable"; }
class AccessLimited extends CredentialsSignin {
  constructor(retryAfter: number) { super(); this.code = `rate_limited_${retryAfter}`; }
}

async function handleAuth(request: NextRequest) {
  const origin = applicationOrigin(request);
  let sessionUnavailable = false;
  const { handlers } = NextAuth({
    secret: getAuthConfig().secret,
    ...authConfig,
    logger: { error(error) { console.error("Authentication failed", error instanceof AuthError ? error.type : "Unknown"); } },
    callbacks: {
      ...authConfig.callbacks,
      async redirect(args) {
        return authConfig.callbacks.redirect({ ...args, baseUrl: origin });
      },
      // https://authjs.dev/guides/extending-the-session#with-jwt
      async jwt(args) {
        const token = await authConfig.callbacks.jwt(args);
        if (!token) return null;
        const account = await verifySessionAccount(token.uid, token.authVersion);
        if (account.status === "unavailable") {
          if (args.trigger === "signIn") throw new AccessUnavailable();
          sessionUnavailable = true;
          return null;
        }
        if (account.status === "invalid") return null;
        token.role = account.user.role;
        token.email = account.user.email;
        token.name = account.user.name;
        return token;
      },
    },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(creds) {
          try { return await limitedCredentials(creds); }
          catch (error) {
            if (error instanceof LoginLimitError) throw new AccessLimited(error.retryAfter);
            throw new AccessUnavailable();
          }
        },
      }),
    ],
  });
  const response = await handlers[request.method === "POST" ? "POST" : "GET"](request);
  // Auth.js clears the cookie when the JWT callback returns null. Discard
  // that response during an outage so the original cookie can be retried.
  if (sessionUnavailable) {
    return apiError(503, "PERSISTENCE_UNAVAILABLE", "Servicio temporalmente no disponible", {
      "Cache-Control": "private, no-store",
    });
  }
  return response;
}

export { handleAuth as GET, handleAuth as POST };
