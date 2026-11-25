import { notificationsEnabled } from "@/shared/config";
import { notificationsDisabled } from "@/server/notifications/disabled";
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { checkMutationOrigin } from "@/server/request-origin";
import { accountError, apiError, readJson } from "@/server/http-errors";

type Context = { params: Promise<{ id: string }> };
const tokenSchema = z.strictObject({ token: z.string().min(1).max(4096) });

async function authorizeToken(req: Request, context: Context) {
  const { session, error } = await requireSession();
  if (error) return { error };
  const originError = checkMutationOrigin(req);
  if (originError) return { error: originError };
  const { id } = await context.params;
  if (!isAdmin(session) && session.user.id !== id) return { error: forbid() };
  if (!isValidObjectId(id)) return { error: apiError(400, "INVALID_INPUT", "Identificador no válido") };
  return { id };
}

export async function POST(req: Request, context: Context) {
  if (!notificationsEnabled) return notificationsDisabled();
  const authorized = await authorizeToken(req, context);
  if (authorized.error) return authorized.error;
  const parsed = tokenSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Token no válido");
  try {
    await dbConnect();
    const user = await User.findByIdAndUpdate(authorized.id, { $set: { fcmToken: parsed.data.token } }, { returnDocument: "after", runValidators: true, projection: { _id: 1 } }).lean();
    if (!user) return apiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    return NextResponse.json({ success: true });
  } catch (error) { return accountError(error); }
}

export async function DELETE(req: Request, context: Context) {
  if (!notificationsEnabled) return notificationsDisabled();
  const authorized = await authorizeToken(req, context);
  if (authorized.error) return authorized.error;
  try {
    await dbConnect();
    const user = await User.findByIdAndUpdate(authorized.id, { $set: { fcmToken: null } }, { returnDocument: "after", runValidators: true, projection: { _id: 1 } }).lean();
    if (!user) return apiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    return NextResponse.json({ success: true });
  } catch (error) { return accountError(error); }
}
