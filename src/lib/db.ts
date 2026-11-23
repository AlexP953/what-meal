import mongoose from "mongoose";
import { getDatabaseConfig } from "@/server/config";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const mongoGlobal = globalThis as typeof globalThis & { _mongoose?: Cache };
const cached = mongoGlobal._mongoose ??= { conn: null, promise: null } as Cache;

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  const { uri, dbName } = getDatabaseConfig();

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      dbName,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
