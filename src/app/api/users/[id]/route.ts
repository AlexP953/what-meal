import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { updateUserSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserLean } from '../../../types/index'


const updateUserAdminSchema = updateUserSchema.extend({
  role: z.enum(["admin", "user"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!session?.user) return forbid();

  const sameUser = session.user.id === params.id;
  const admin = isAdmin(session);
  if (!admin && !sameUser) return forbid();

  const body = await req.json();
  const parsed = (admin ? updateUserAdminSchema : updateUserSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { email, name, password, role } = parsed.data as any;

  try {
    await dbConnect();

    const update: Record<string, any> = {};
    if (email) update.email = email.toLowerCase().trim();
    if (name) update.name = name;
    if (password) update.passwordHash = await bcrypt.hash(password, 12);
    if (admin && role) update.role = role; 

    if (update.email) {
      const dup = await User.findOne({ email: update.email, _id: { $ne: params.id } }).lean();
      if (dup) return NextResponse.json({ error: "Email ya en uso" }, { status: 409 });
    }

    const user = await User.findByIdAndUpdate(
      params.id,
      { $set: update },
      { new: true, runValidators: true, projection: { email: 1, name: 1, tz: 1, role: 1 } }
    ).lean<UserLean | null>();

    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    return NextResponse.json(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name ?? null,
        role: user.role,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!isAdmin(session)) return forbid();

  try {
    await dbConnect();

    const deleted = await User.findByIdAndDelete(params.id).lean();

    if (!deleted) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
