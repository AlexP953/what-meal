import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Meal, serializeMeal } from "@/server/persistence/meal";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { updateMealSchema } from "@/lib/validations";
import { isValidObjectId } from "mongoose";
import type { Session } from "next-auth";
import { apiError, dataError } from "@/server/http-errors";

function mealNotFound() {
  return apiError(404, "MEAL_NOT_FOUND", "Comida no encontrada");
}

async function accessibleMeal(id: string, session: Session) {
  if (!isValidObjectId(id)) return { error: apiError(400, "INVALID_INPUT", "Identificador no válido") };
  await dbConnect();
  const meal = await Meal.findById(id).lean();
  if (!meal) return { error: mealNotFound() };
  if (meal.userId.toString() !== session.user?.id && !isAdmin(session)) return { error: forbid() };
  return { meal };
}

const ALLOWED_FIELDS = new Set([
  "name",
  "date",
  "type",
  "reaction",
  "place",
  "notes",
]);

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await context.params;

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
    { returnDocument: "after", runValidators: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const publicMeal = serializeMeal(updated);
  return NextResponse.json(
    {
      meal: {
        id: publicMeal._id.toString(),
        name: publicMeal.name,
        date: publicMeal.date,
        type: publicMeal.type,
        reaction: publicMeal.reaction,
        place: publicMeal.place ?? null,
        notes: publicMeal.notes ?? null,
        userId: publicMeal.userId?.toString() ?? null,
      },
    },
    { status: 200 }
  );
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const { session, error } = await requireSession();
  if (error) return error;

  await dbConnect();
  const existing = await Meal.findById(id);

  if (!existing) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const isSelf = session.user?.id === existing.userId?.toString();
  if (!isAdmin(session) && !isSelf) {
    return forbid();
  }

  try {

    const deleted = await Meal.findByIdAndDelete(id).lean();

    if (!deleted) {
      return NextResponse.json(
        { error: "Meal no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Meal eliminado" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const { id } = await context.params;
    const result = await accessibleMeal(id, session);
    if (result.error) return result.error;
    return NextResponse.json({ meal: serializeMeal(result.meal) });
  } catch (error) {
    return dataError(error);
  }
}
