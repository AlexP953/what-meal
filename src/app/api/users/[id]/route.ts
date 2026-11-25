import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { serializeMeal, type MealRecord } from "@/server/persistence/meal";
import { User, serializeUser, type UserRecord } from "@/server/persistence/user";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { updateUserSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { checkMutationOrigin } from "@/server/request-origin";

const updateUserAdminSchema = updateUserSchema.extend({
  role: z.enum(["admin", "user"]).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  const { id } = await context.params;

  if (error) return error;

  const originError = checkMutationOrigin(req);
  if (originError) return originError;

  if (!session?.user) return forbid();

  const sameUser = session!.user.id === id;
  const admin = isAdmin(session);
  if (!admin && !sameUser) return forbid();

  const body = await req.json();
  const parsed = (admin ? updateUserAdminSchema : updateUserSchema).safeParse(
    body
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { email, name, password, role } = parsed.data as z.infer<typeof updateUserAdminSchema>;

  try {
    await dbConnect();

    const update: Record<string, string> = {};
    if (email) update.email = email.toLowerCase().trim();
    if (name) update.name = name;
    if (password) update.passwordHash = await bcrypt.hash(password, 12);
    if (admin && role) update.role = role;

    if (update.email) {
      const dup = await User.findOne({
        email: update.email,
        _id: { $ne: id },
      }).lean();
      if (dup)
        return NextResponse.json({ error: "Email ya en uso" }, { status: 409 });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: update },
      {
        returnDocument: "after",
        runValidators: true,
        projection: { email: 1, name: 1, role: 1, createdAt: 1, updatedAt: 1 },
      }
    ).lean<UserRecord | null>();

    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );

    const publicUser = serializeUser(user);
    return NextResponse.json(
      {
        id: publicUser.id,
        email: publicUser.email,
        name: publicUser.name ?? null,
        role: publicUser.role,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const { session, error } = await requireSession();
  if (error) return error;

  const originError = checkMutationOrigin(req);
  if (originError) return originError;

  if (!isAdmin(session)) return forbid();

  try {
    await dbConnect();

    const deleted = await User.findByIdAndDelete(id).lean();

    if (!deleted) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await context.params;

  const isSelf = session.user?.id === id;
  if (!isAdmin(session) && !isSelf) return forbid();

  try {
    await dbConnect();

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const user = await User.findById(id)
      .select("-passwordHash -fcmToken -__v")
      .populate<{ meals: MealRecord[] }>({
        path: "meals",
        options: { sort: { date: -1, createdAt: -1 } },
      });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: { ...serializeUser(user), meals: (user.meals ?? []).map(serializeMeal) } }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
