import { readFileSync } from "node:fs";

function readSecret(name) {
  try {
    const value = readFileSync(`/run/secrets/${name}`, "utf8").replace(/\n+$/, "");
    if (/^[a-f0-9]{64}$/.test(value) && new Set(value).size >= 12 && value.slice(0, 32) !== value.slice(32)) return value;
  } catch {
    // File errors and invalid values share a diagnostic that omits file contents.
  }
  throw new Error(`Invalid or unreadable deployment secret ${name}`);
}

function httpsOrigin(value) {
  const url = URL.parse(value ?? "");
  if (url?.protocol !== "https:" || (value !== url.origin && value !== `${url.origin}/`)) {
    throw new Error("AUTH_URL must be a canonical HTTPS origin");
  }
  return url.origin;
}

try {
  const origin = httpsOrigin(process.env.AUTH_URL);
  const appPassword = readSecret("mongo_app_password");
  const authSecret = readSecret("auth_secret");
  if (appPassword === authSecret) throw new Error("Deployment secrets must differ");

  // Replace this wrapper so the application receives Docker's stop signal directly.
  process.execve(process.execPath, [process.execPath, ...process.argv.slice(2)], {
    ...process.env,
    AUTH_URL: origin,
    AUTH_SECRET: authSecret,
    MONGODB_DB: "whatmeal",
    MONGODB_URI: `mongodb://whatmeal_app:${appPassword}@mongo:27017/whatmeal`,
    NEXT_PUBLIC_NOTIFICATIONS_ENABLED: "false",
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
