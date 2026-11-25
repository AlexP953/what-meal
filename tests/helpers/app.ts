import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const appFiles = [
  "next.config.ts", "node_modules", "package.json", "package-lock.json",
  "postcss.config.mjs", "public", "src", "tsconfig.json",
];

function appEnvironment(nodeEnv: "development" | "production"): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: nodeEnv, NEXT_PUBLIC_NOTIFICATIONS_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" };
  delete env.AUTH_URL;
  delete env.NEXTAUTH_URL;
  return env;
}

export function isolatedTestApp() {
  let workspace: Promise<string> | undefined;
  let directory: string | undefined;
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined;

  const prepare = () => workspace ??= (async () => {
    directory = await mkdtemp(join(tmpdir(), "whatmeal-app-"));
    const cwd = directory;
    // Next.js loads dotenv files relative to the app root in dev and production.
    await promisify(execFile)("cp", ["-a", ...appFiles, cwd], { timeout: 60000 });
    return cwd;
  })();

  return {
    async build() {
      await promisify(execFile)(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
        cwd: await prepare(), env: appEnvironment("production"), timeout: 120000,
      });
    },
    async start(mode: "dev" | "start" = "dev", overrides: Record<string, string> = {}) {
      app = await startTestApp(await prepare(), mode, overrides);
      return app;
    },
    async cleanup() {
      try { await app?.stop(); }
      finally { if (directory) await rm(directory, { recursive: true, force: true }); }
    },
  };
}

async function startTestApp(cwd: string, mode: "dev" | "start", overrides: Record<string, string>) {
  const env = {
    ...appEnvironment(mode === "dev" ? "development" : "production"),
    AUTH_SECRET: randomBytes(32).toString("hex"),
    AUTH_TRUST_HOST: "true",
    ...overrides,
  };
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", mode, "--hostname", "127.0.0.1", "--port", "0"], {
    detached: true, stdio: ["ignore", "pipe", "pipe"],
    cwd, env,
  });
  let output = "";
  let baseUrl = "";
  child.stdout.on("data", chunk => { output = (output + chunk).slice(-8192); baseUrl ||= output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? ""; });
  // Drain errors without publishing app logs, which can contain private configuration.
  const errorTypes: string[] = [];
  child.stderr.on("data", chunk => {
    for (const match of String(chunk).matchAll(/Authentication failed ([A-Za-z]+)/g)) errorTypes.push(match[1]);
  });
  async function stopProcess() {
    if (!child.pid) return;
    try { process.kill(-child.pid, "SIGTERM"); } catch { return; }
    for (let attempt = 0; attempt < 50 && child.exitCode === null && child.signalCode === null; attempt++) await delay(100);
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already stopped. */ }
  }
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= stopProcess();
  try {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error("Test app terminated before readiness");
      if (baseUrl) {
        try { if ((await fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(1000) })).ok) return { baseUrl, stop, errorTypes }; } catch { /* Await readiness. */ }
      }
      await delay(200);
    }
    throw new Error("Test app readiness timed out");
  } catch (error) { await stop(); throw error; }
}

export function authClient(baseUrl: string) {
  const cookies = new Map<string, string>();
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!value) cookies.delete(name); else cookies.set(name, value);
    }
    return response;
  }
  async function csrf() { return (await (await request("/api/auth/csrf")).json()).csrfToken as string; }
  async function signIn(email: string, password: string, callbackUrl = baseUrl) {
    return request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" }, body: new URLSearchParams({ email, password, csrfToken: await csrf(), callbackUrl }) });
  }
  async function signOut() {
    return request("/api/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" }, body: new URLSearchParams({ csrfToken: await csrf(), callbackUrl: `${baseUrl}/login` }) });
  }
  async function updateSession(data: unknown) {
    return request("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csrfToken: await csrf(), data }) });
  }
  return { request, signIn, signOut, updateSession };
}
