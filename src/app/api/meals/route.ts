import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Meal } from "@/app/models/Meal";
import { addMealSchema } from "@/lib/validations";
import { requireSession, isAdmin } from "@/lib/authz";
import { Types } from "mongoose";

function isError<T>(
  x: T | { error: NextResponse }
): x is { error: NextResponse } {
  return typeof (x as any)?.error !== "undefined";
}

export async function GET(req: Request) {
  const res = await requireSession();
  if (isError(res)) return res.error;
  const { session } = res;

  const url = new URL(req.url);
  const filter: Record<string, any> = { userId: session.user!.id };

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
    items.map((m) => ({
      id: m._id!.toString(),
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
  const res = await requireSession();
  if (isError(res)) return res.error;
  const { session } = res;

  const json = await req.json();
  const parsed = addMealSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await dbConnect();
  const doc = await Meal.create({ ...parsed.data, userId: session.user!.id });
  return NextResponse.json(
    {
      id: doc._id.toString(),
      name: doc.name,
      date: doc.date,
      type: doc.type,
      reaction: doc.reaction,
      place: doc.place ?? null,
      notes: doc.notes ?? null,
      user: session.user!.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    { status: 201 }
  );
}
