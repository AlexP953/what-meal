import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthConfig } from "@/server/config";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { limitedCredentials, LoginLimitError } from "@/server/login-access";
import { verifySessionAccount } from "@/server/session-account";
import { applicationOrigin } from "@/server/request-origin";
import { apiError } from "@/server/http-errors";
import { adaptAuthResponse, withoutSessionCookie, type LoginFailure } from "@/server/auth-response";

class AccessUnavailable extends CredentialsSignin { code = "persistence_unavailable"; }
class AccessLimited extends CredentialsSignin {
  constructor(retryAfter: number) { super(); this.code = `rate_limited_${retryAfter}`; }
}

async function handleAuth(request: NextRequest) {
  const origin = applicationOrigin(request);
  let loginFailure: LoginFailure | undefined;
  let sessionUnavailable = false;
  function failUnavailable(): never {
    loginFailure = { status: 503 };
    throw new AccessUnavailable();
  }
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
        if (account.status !== "valid") {
          if (args.trigger === "signIn") {
            if (account.status === "unavailable") failUnavailable();
            throw new CredentialsSignin();
          }
          sessionUnavailable = account.status === "unavailable";
          return null;
        }
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
            if (error instanceof LoginLimitError) {
              loginFailure = { status: 429, retryAfter: error.retryAfter };
              throw new AccessLimited(error.retryAfter);
            }
            failUnavailable();
          }
        },
      }),
    ],
  });
  const response = await handlers[request.method === "POST" ? "POST" : "GET"](request);
  if (sessionUnavailable) {
    return apiError(503, "PERSISTENCE_UNAVAILABLE", "Servicio temporalmente no disponible", {
      "Cache-Control": "private, no-store",
    });
  }
  const { pathname } = request.nextUrl;
  if (request.method === "POST" && (pathname === "/api/auth/callback/credentials" || pathname === "/api/auth/signout")) {
    return adaptAuthResponse(response, loginFailure);
  }
  // A session check can finish after sign-out. Only explicit auth actions write its cookie.
  return withoutSessionCookie(response);
}

export { handleAuth as GET, handleAuth as POST };
