import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";
import bcrypt from "bcryptjs";

type UserAuth = { _id: any; email: string; passwordHash: string; name?: string; role: "admin"|"user" };

export const { auth, signIn, signOut, handlers: { GET, POST } } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email || "").toLowerCase().trim();
        const password = String(creds?.password || "");
        await dbConnect();
        const user = await User.findOne({ email }).lean<UserAuth | null>();
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: String(user._id), email: user.email, name: user.name || "", role: user.role };
      },
    }),
  ],
});
