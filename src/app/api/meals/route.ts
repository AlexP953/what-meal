import { NextResponse } from "next/server";
import { isValidObjectId, type QueryFilter } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Meal, serializeListedMeal, type MealRecord } from "@/server/persistence/meal";
import { addMealSchema, mealFiltersSchema } from "@/lib/validations";
import { requireSession, isAdmin } from "@/lib/authz";
import { apiError, dataError, readJson } from "@/server/http-errors";
import { checkMutationOrigin } from "@/server/request-origin";

export async function GET(req: Request) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const selectedUser = isAdmin(session) ? searchParams.get("userId") : null;
    if (selectedUser !== null && !isValidObjectId(selectedUser)) {
      return apiError(400, "INVALID_INPUT", "Identificador de cuenta no válido");
    }

    const parsed = mealFiltersSchema.safeParse({
      type: searchParams.get("type") ?? undefined,
      reactions: searchParams.getAll("reaction"),
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      sortDir: searchParams.get("sortDir") ?? undefined,
    });
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Filtros no válidos");

    const { type, reactions, dateFrom, dateTo, sortDir } = parsed.data;
    const filter: QueryFilter<MealRecord> = { userId: selectedUser ?? session.user!.id };
    if (type) filter.type = type;
    if (reactions.length) filter.reaction = { $in: reactions };
    if (dateFrom || dateTo) {
      filter.date = {
        ...(dateFrom && { $gte: dateFrom }),
        ...(dateTo && { $lte: dateTo }),
      };
    }

    await dbConnect();
    const items = await Meal.find(filter)
      .sort({ date: sortDir === "asc" ? 1 : -1, createdAt: -1, _id: -1 })
      .lean();
    return NextResponse.json(items.map(serializeListedMeal));
  } catch (error) {
    return dataError(error);
  }
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
    const meal = await Meal.create({ ...parsed.data, userId: session.user!.id });
    return NextResponse.json(serializeListedMeal(meal), { status: 201 });
  } catch (error) {
    return dataError(error);
  }
}
