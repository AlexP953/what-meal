import type { DefaultSession } from "next-auth";

// https://authjs.dev/getting-started/typescript#module-augmentation
// These fields mirror the existing Credentials/JWT payload.
declare module "next-auth" {
  interface User {
    role: "admin" | "user";
  }
  interface Session {
    user: { id: string; role: "admin" | "user" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "admin" | "user";
  }
}
