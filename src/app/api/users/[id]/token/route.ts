import { notificationsEnabled } from "@/shared/config";
import { notificationsDisabled } from "@/server/notifications/disabled";
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";
import mongoose from "mongoose";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!notificationsEnabled) return notificationsDisabled();
  const { id } = await params;
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  await dbConnect();

  const objectId = new mongoose.Types.ObjectId(id);

  const user = await User.findByIdAndUpdate(
    objectId,
    { fcmToken: token },
    { returnDocument: "after" }
  );

  if (!user) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!notificationsEnabled) return notificationsDisabled();
  const { id } = await params;
  await dbConnect();
  const objectId = new mongoose.Types.ObjectId(id);

  const user = await User.findByIdAndUpdate(
    objectId,
    { fcmToken: null },
    { returnDocument: "after" }
  );

  if (!user) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
