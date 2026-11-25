import NextAuth from "next-auth";
import { getAuthConfig } from "@/server/config";
import { authConfig } from "./auth.config";

export const { auth } = NextAuth(() => ({
  secret: getAuthConfig().secret,
  ...authConfig,
  providers: [],
}));
