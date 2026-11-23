import mongoose from "mongoose";
import { getDatabaseConfig } from "@/server/config";

let cached = (global as any)._mongoose as {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

if (!cached) {
  cached = (global as any)._mongoose = { conn: null, promise: null };
}

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
