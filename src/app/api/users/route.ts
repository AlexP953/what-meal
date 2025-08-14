import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";
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

    return NextResponse.json(
      { id: String(user._id), email: user.email, name: user.name, role: user.role ?? null },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
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
      .select("email name role createdAt") 
      .lean();

    return NextResponse.json({ users }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}