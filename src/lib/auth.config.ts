import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], 
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "admin" | "user";
      return session;
    },
  },
} satisfies NextAuthConfig;
