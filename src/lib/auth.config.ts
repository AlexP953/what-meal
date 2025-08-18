import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], 
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).user.id = token.uid as string;
      (session as any).user.role = token.role as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
