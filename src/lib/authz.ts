import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export async function requireSession(): Promise<
  | { session: Session; error?: undefined }
  | { session?: undefined; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export function isAdmin(session: any) {
  return session?.user?.role === "admin";
}

export function forbid() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
