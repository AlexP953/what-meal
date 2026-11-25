import "server-only";
import mongoose from "mongoose";
import { getDatabaseConfig } from "@/server/config";

type Cache = { pending: Promise<typeof mongoose> | null };
const mongoGlobal = globalThis as typeof globalThis & { whatMealMongo?: Cache };
const cache = mongoGlobal.whatMealMongo ??= { pending: null };

export class DatabaseConnectionError extends Error {
  constructor() {
    super("MongoDB connection failed");
    this.name = "DatabaseConnectionError";
  }
}

export function dbConnect(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (cache.pending) return cache.pending;
  const { uri, dbName } = getDatabaseConfig();
  // https://mongoosejs.com/docs/connections.html#serverSelectionTimeoutMS
  cache.pending = mongoose.connect(uri, {
    dbName,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  }).then(
    (connection) => { cache.pending = null; return connection; },
    () => { cache.pending = null; throw new DatabaseConnectionError(); },
  );
  return cache.pending;
}
