import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Meal, serializeMeal } from "@/server/persistence/meal";
import { addMealSchema } from "@/lib/validations";
import { requireSession, isAdmin } from "@/lib/authz";
import { Types } from "mongoose";
import { apiError, dataError, readJson } from "@/server/http-errors";
import { checkMutationOrigin } from "@/server/request-origin";
import type { ListedMeal } from "@/shared/meal";

function isError<T>(
  x: T | { error: NextResponse }
): x is { error: NextResponse } {
  return typeof (x as { error?: unknown })?.error !== "undefined";
}

export async function GET(req: Request) {
  const res = await requireSession();
  if (isError(res)) return res.error;
  const { session } = res;

  const url = new URL(req.url);
  const filter: Record<string, string> = { userId: session.user!.id };

  const userIdParam = url.searchParams.get("userId");
  if (userIdParam && isAdmin(session)) {
    if (!Types.ObjectId.isValid(userIdParam)) {
      return NextResponse.json({ message: "userId inválido" }, { status: 400 });
    }
    filter.userId = userIdParam;
  }

  await dbConnect();
  const items = await Meal.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .lean();
  return NextResponse.json(
    items.map(serializeMeal).map((m) => ({
      id: m.id,
      name: m.name,
      date: m.date,
      type: m.type,
      reaction: m.reaction,
      place: m.place ?? null,
      notes: m.notes ?? null,
      user: m.userId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }))
  );
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const originError = checkMutationOrigin(req);
    if (originError) return originError;

    const parsed = addMealSchema.safeParse(await readJson(req));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Datos no válidos");

    await dbConnect();
    const { _id, userId, place, notes, ...meal } = serializeMeal(
      await Meal.create({ ...parsed.data, userId: session.user!.id })
    );
    const result: ListedMeal = {
      ...meal, id: _id, user: userId, place: place ?? null, notes: notes ?? null,
    };
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return dataError(error);
  }
}
