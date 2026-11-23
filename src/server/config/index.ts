import "server-only";

type Environment = Record<string, string | undefined>;

function invalid(name: string): never {
  throw new Error(`Invalid or missing ${name}`);
}

export function getDatabaseConfig(env: Environment = process.env) {
  const uri = env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(uri)) invalid("MONGODB_URI");
  const dbName = env.MONGODB_DB;
  if (!dbName || !/^[a-zA-Z0-9_-]{1,63}$/.test(dbName)) invalid("MONGODB_DB");
  return { uri, dbName };
}

export function getAuthConfig(env: Environment = process.env) {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.trim().length < 32) invalid("AUTH_SECRET");
  return { secret };
}
