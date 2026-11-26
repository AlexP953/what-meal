import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { authClient } from "../tests/helpers/app";
import type { ListedMeal, PublicMeal } from "../src/shared/meal";

const fixture = { name: "Deployment test meal", type: "lunch", date: "2024-02-29", reaction: "good" };

async function json<T>(response: Response, status: number): Promise<T> {
  assert.equal(response.status, status);
  return response.json();
}

async function main() {
  const [flag, mode, address, snapshot] = process.argv.slice(2);
  const url = URL.parse(address ?? "");
  if (flag !== "--disposable" || (mode !== "seed" && mode !== "read") ||
    !url || url.protocol !== "https:" || address !== url.origin || !snapshot ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Use --disposable seed|read https://host snapshot.json with certificate validation enabled.");
  }

  const secrets = mode === "seed"
    ? { email: `deployment-probe-${randomUUID()}@example.com`, password: randomBytes(32).toString("hex") }
    : JSON.parse(await readFile(snapshot, "utf8")) as { email: string; password: string; meal?: PublicMeal };
  const client = authClient(url.origin);
  const anonymous = await json<{ code: string }>(await client.request("/api/meals"), 401);
  assert.equal(anonymous.code, "UNAUTHORIZED");

  if (mode === "seed") {
    await json(await client.request("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin },
      body: JSON.stringify(secrets),
    }), 201);
  }

  const signIn = await client.signIn(secrets.email, secrets.password, "https://foreign.example/meals");
  const sessionCookie = signIn.headers.getSetCookie().find(cookie => cookie.startsWith("__Secure-authjs.session-token="));
  assert.ok(sessionCookie?.split(";").some(attribute => attribute.trim().toLowerCase() === "secure"));
  const redirect = await json<{ url: string }>(signIn, 200);
  assert.equal(new URL(redirect.url).origin, url.origin);
  const session = await json<{ user: { id: string } }>(await client.request("/api/auth/session"), 200);
  assert.ok(session.user?.id);

  const write = (origin: string) => client.request("/api/meals", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(fixture),
  });
  const forbidden = await json<{ code: string }>(await write("https://foreign.example"), 403);
  assert.equal(forbidden.code, "FORBIDDEN_ORIGIN");

  const expected = "meal" in secrets ? secrets.meal : undefined;
  const id = mode === "seed" ? (await json<ListedMeal>(await write(url.origin), 201)).id : expected?.id;
  assert.ok(id);
  const { meal } = await json<{ meal: PublicMeal }>(await client.request(`/api/meals/${id}`), 200);
  const meals = await json<ListedMeal[]>(await client.request("/api/meals"), 200);
  assert.ok(meals.some(item => item.id === id && item.user === session.user.id));
  assert.equal(meal.userId, session.user.id);
  for (const [key, value] of Object.entries(fixture)) assert.equal(meal[key as keyof PublicMeal], value);

  if (mode === "seed") {
    await writeFile(snapshot, JSON.stringify({ ...secrets, meal }), { mode: 0o600, flag: "wx" });
  } else {
    assert.deepEqual(meal, expected);
  }
  console.log(`Deployment diary probe ${mode} passed.`);
}

void main().catch(() => {
  console.error("Deployment diary probe failed. Check HTTPS and use a disposable deployment and a private snapshot path.");
  process.exitCode = 1;
});
