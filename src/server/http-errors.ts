import "server-only";
import { NextResponse } from "next/server";
import { DatabaseConnectionError } from "@/server/persistence/connection";

export function apiError(status: number, code: string, error: string, headers?: HeadersInit) {
  return NextResponse.json({ error, code }, { status, headers });
}

export function accountError(error: unknown) {
  if ((error as { code?: number })?.code === 11000) return apiError(409, "EMAIL_EXISTS", "Email ya registrado");
  if (error instanceof DatabaseConnectionError) return apiError(503, "PERSISTENCE_UNAVAILABLE", "Servicio temporalmente no disponible");
  return apiError(500, "INTERNAL_ERROR", "Error del servidor");
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return undefined; }
}
