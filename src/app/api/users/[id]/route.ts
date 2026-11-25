import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { serializeMeal, type MealRecord } from "@/server/persistence/meal";
import { User, serializeUser } from "@/server/persistence/user";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { updateUserSchema, updateUserAdminSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { checkMutationOrigin } from "@/server/request-origin";
import { accountError, apiError, readJson } from "@/server/http-errors";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { session, error } = await requireSession();
  if (error) return error;
  const originError = checkMutationOrigin(req);
  if (originError) return originError;
  const { id } = await context.params;
  const admin = isAdmin(session);
  if (!admin && session.user.id !== id) return forbid();
  if (!isValidObjectId(id)) return apiError(400, "INVALID_INPUT", "Identificador no válido");
  const body = await readJson(req);
  if (!admin && body && typeof body === "object" && Object.hasOwn(body, "role")) return forbid();
  const parsed = (admin ? updateUserAdminSchema : updateUserSchema).safeParse(body);
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Comprueba los campos de la cuenta");
  const { email, name, password, role } = parsed.data as { email?: string; name?: string; password?: string; role?: "admin" | "user" };
  try {
    await dbConnect();
    const update: Record<string, string> = {};
    if (email !== undefined) update.email = email;
    if (name !== undefined) update.name = name;
    if (password !== undefined) update.passwordHash = await bcrypt.hash(password, 12);
    if (admin && role !== undefined) update.role = role;
    // Hash replacement and revocation version must change in the same atomic write.
    const user = await User.findByIdAndUpdate(id, { $set: update, ...(password !== undefined ? { $inc: { authVersion: 1 } } : {}) }, {
      returnDocument: "after", runValidators: true,
      projection: { email: 1, name: 1, role: 1, createdAt: 1, updatedAt: 1 },
    }).lean();
    if (!user) return apiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    const publicUser = serializeUser(user);
    return NextResponse.json({ id: publicUser.id, email: publicUser.email, name: publicUser.name ?? null, role: publicUser.role });
  } catch (error) { return accountError(error); }
}

export async function DELETE(req: Request, context: Context) {
  const { session, error } = await requireSession();
  if (error) return error;
  const originError = checkMutationOrigin(req);
  if (originError) return originError;
  if (!isAdmin(session)) return forbid();
  const { id } = await context.params;
  if (!isValidObjectId(id)) return apiError(400, "INVALID_INPUT", "Identificador no válido");
  try {
    await dbConnect();
    const deleted = await User.findByIdAndDelete(id).lean();
    if (!deleted) return apiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    return NextResponse.json({ message: "Usuario eliminado" });
  } catch (error) { return accountError(error); }
}

export async function GET(req: Request, context: Context) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await context.params;
  if (!isAdmin(session) && session.user.id !== id) return forbid();
  if (!isValidObjectId(id)) return apiError(400, "INVALID_INPUT", "Identificador no válido");
  try {
    await dbConnect();
    const user = await User.findById(id).select("-passwordHash -fcmToken -__v").populate<{ meals: MealRecord[] }>({ path: "meals", options: { sort: { date: -1, createdAt: -1 } } });
    if (!user) return apiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    return NextResponse.json({ user: { ...serializeUser(user), meals: (user.meals ?? []).map(serializeMeal) } });
  } catch (error) { return accountError(error); }
}
