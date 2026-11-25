import NextAuth from "next-auth";
import { getAuthConfig } from "@/server/config";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authorizeCredentials } from "@/server/credentials";
import { verifySessionAccount } from "@/server/session-account";

export const { auth, signIn, signOut, handlers: { GET, POST } } = NextAuth(() => ({
  secret: getAuthConfig().secret,
  ...authConfig,
  logger: { error() { console.error("Authentication failed"); } },
  callbacks: {
    ...authConfig.callbacks,
    // https://authjs.dev/guides/extending-the-session#with-jwt
    async jwt(args) {
      const token = await authConfig.callbacks.jwt(args);
      if (!token) return null;
      const account = await verifySessionAccount(token.uid, token.authVersion);
      if (account.status !== "valid") return null;
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
        return authorizeCredentials(creds);
      },
    }),
  ],
}));
