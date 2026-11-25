import "server-only";
import { NextResponse } from "next/server";
import { DatabaseConnectionError } from "@/server/persistence/connection";
import mongoose, { mongo } from "mongoose";

export function apiError(status: number, code: string, error: string, headers?: HeadersInit) {
  return NextResponse.json({ error, code }, { status, headers });
}

export function accountError(error: unknown) {
  if ((error as { code?: number })?.code === 11000) return apiError(409, "EMAIL_EXISTS", "Email ya registrado");
  return dataError(error);
}

export function dataError(error: unknown) {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) return apiError(400, "INVALID_INPUT", "Datos no válidos");
  if (error instanceof DatabaseConnectionError || error instanceof mongo.MongoNetworkError || error instanceof mongo.MongoServerSelectionError || error instanceof mongo.MongoTopologyClosedError) return apiError(503, "PERSISTENCE_UNAVAILABLE", "Servicio temporalmente no disponible");
  return apiError(500, "INTERNAL_ERROR", "Error del servidor");
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return undefined; }
}
