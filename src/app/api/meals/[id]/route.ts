import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Meal } from "@/app/models/Meal";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { updateMealSchema } from "@/lib/validations";
import { MealLean } from "../../../types";
import { isValidObjectId } from "mongoose";

const ALLOWED_FIELDS = new Set([
  "name",
  "date",
  "type",
  "reaction",
  "place",
  "notes",
]);

export async function PATCH(req: Request, context: any) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = (context as { params: { id: string } }).params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await dbConnect();

  const existing = await Meal.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const isSelf = session.user?.id === existing.userId?.toString();
  if (!isAdmin(session) && !isSelf) {
    return forbid();
  }

  const body = await req.json().catch(() => ({}));
  if ("userId" in body) delete body.userId;

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) sanitized[k] = v;
  }

  const parsed = updateMealSchema.safeParse(sanitized);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await Meal.findByIdAndUpdate(
    id,
    { $set: parsed.data },
    { new: true, runValidators: true }
  ).lean<MealLean>();

  if (!updated) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      meal: {
        id: updated._id.toString(),
        name: updated.name,
        date: updated.date,
        type: updated.type,
        reaction: updated.reaction,
        place: updated.place ?? null,
        notes: updated.notes ?? null,
        userId: updated.userId?.toString() ?? null,
      },
    },
    { status: 200 }
  );
}

export async function DELETE(req: Request, context: any) {
  const { id } = (context as { params: { id: string } }).params;

  const { session, error } = await requireSession();
  if (error) return error;

  const existing = await Meal.findById(id);

  if (!existing) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const isSelf = session.user?.id === existing.userId?.toString();
  if (!isAdmin(session) && !isSelf) {
    return forbid();
  }

  try {
    await dbConnect();

    const deleted = await Meal.findByIdAndDelete(id).lean();

    if (!deleted) {
      return NextResponse.json(
        { error: "Meal no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Meal eliminado" }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request, context: any) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = (context as { params: { id: string } }).params;

  try {
    await dbConnect();

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const meal = await Meal.findById(id);

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    const isSelf = session.user?.id === meal.userId.toString();

    if (!isAdmin(session) && !isSelf) return forbid();

    return NextResponse.json({ meal }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
