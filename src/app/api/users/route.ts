import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User, serializeUser } from "@/server/persistence/user";
import { registerSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { requireSession, isAdmin, forbid } from "@/lib/authz";
import { reserveAccess } from "@/server/access-limits";
import { accountError, apiError, readJson } from "@/server/http-errors";
import { checkMutationOrigin } from "@/server/request-origin";

export async function POST(req: Request) {
  const originError = checkMutationOrigin(req);
  if (originError) return originError;
  try {
    const limit = await reserveAccess("registration");
    if (!limit.allowed) return apiError(429, "RATE_LIMITED", "Demasiados intentos. Inténtalo más tarde", { "Retry-After": String(limit.retryAfter) });
    const body = await readJson(req);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, "INVALID_INPUT", "Comprueba el correo, el nombre y la contraseña de 12 caracteres y máximo 72 bytes UTF-8");
    }
    const { email, password, name } = parsed.data;

    await dbConnect();

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name, role: "user" });

    const publicUser = serializeUser(user);
    return NextResponse.json(
      { id: publicUser.id, email: publicUser.email, name: publicUser.name ?? null, role: publicUser.role },
      { status: 201 }
    );
  } catch (error) {
    return accountError(error);
  }
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!isAdmin(session)) return forbid();

  try {
    await dbConnect();

    const users = await User.find()
      .select("email name role createdAt updatedAt")
      .lean();

    return NextResponse.json({ users: users.map((user) => {
      const { _id, email, name, role, createdAt } = serializeUser(user);
      return { _id, email, name, role, createdAt };
    }) }, { status: 200 });
  } catch (error) {
    return accountError(error);
  }
}
