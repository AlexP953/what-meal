import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Meal, serializeMeal } from "@/server/persistence/meal";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { updateMealSchema } from "@/lib/validations";
import { isValidObjectId } from "mongoose";
import type { Session } from "next-auth";
import { apiError, dataError, readJson } from "@/server/http-errors";
import { checkMutationOrigin } from "@/server/request-origin";
import type { EditedMeal } from "@/shared/meal";

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

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const originError = checkMutationOrigin(req);
    if (originError) return originError;

    const { id } = await context.params;
    const result = await accessibleMeal(id, session);
    if (result.error) return result.error;

    const parsed = updateMealSchema.safeParse(await readJson(req));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Datos no válidos");

    const updated = await Meal.findOneAndUpdate(
      { _id: id, userId: result.meal.userId },
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!updated) return mealNotFound();

    const meal: EditedMeal = {
      id: updated._id.toString(),
      userId: updated.userId.toString(),
      name: updated.name,
      date: updated.date,
      type: updated.type,
      reaction: updated.reaction,
      place: updated.place ?? null,
      notes: updated.notes ?? null,
    };
    return NextResponse.json({ meal });
  } catch (error) {
    return dataError(error);
  }
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
