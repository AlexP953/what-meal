import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User, serializeUser } from "@/server/persistence/user";
import { registerSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { requireSession, isAdmin, forbid } from "@/lib/authz";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }
    const { email, password, name, role } = parsed.data;

    await dbConnect();

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, name, role });

    const publicUser = serializeUser(user);
    return NextResponse.json(
      { id: publicUser.id, email: publicUser.email, name: publicUser.name, role: publicUser.role ?? null },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!isAdmin(session)) return forbid();

  try {
    await dbConnect();

    const users = await User.find()
      .select("email name role createdAt updatedAt")
      .lean();

    return NextResponse.json({ users: users.map((user) => {
      const { _id, email, name, role, createdAt } = serializeUser(user);
      return { _id, email, name, role, createdAt };
    }) }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}