import type { NextAuthConfig } from "next-auth";
import { SESSION_MAX_AGE, validSessionClaims } from "./session-claims";

export const authConfig = {
  providers: [], 
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user && trigger !== "update") {
        token.uid = user.id;
        token.role = user.role;
        token.authVersion = user.authVersion;
        token.signedInAt = Date.now();
      }
      return validSessionClaims(token) ? token : null;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "admin" | "user";
      return { ...session, expires: new Date((token.signedInAt as number) + SESSION_MAX_AGE * 1000).toISOString() };
    },
  },
} satisfies NextAuthConfig;
