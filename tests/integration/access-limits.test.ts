import { mongo } from "mongoose";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, expect, it } from "vitest";
import { isolatedDatabase } from "../helpers/database";
import { prepareDatabase } from "@/server/persistence/prepare";
import { accessLimitKey, reserveAccess, completeLogin } from "@/server/access-limits";
import { dbConnect } from "@/server/persistence/connection";

const database = isolatedDatabase();
beforeAll(async () => { database.configure(); process.env.AUTH_SECRET = "test-secret-for-access-limits-only-32"; await prepareDatabase(); });
afterAll(() => database.cleanup());

it("atomically limits concurrent registration and ignores expired events without TTL cleanup", async () => {
  const attempts = await Promise.all(Array.from({ length: 35 }, () => reserveAccess("registration")));
  expect(attempts.filter(a => a.allowed)).toHaveLength(20);
  const denied = attempts.find(a => !a.allowed)!;
  expect(denied.retryAfter).toBeGreaterThan(0);
  const db = (await dbConnect()).connection.db!;
  await db.collection("access_limits").updateOne({ _id: accessLimitKey("registration") as never }, { $set: { events: [{ id: "old", at: new Date(0), until: new Date(0) }] } });
  expect((await reserveAccess("registration")).allowed).toBe(true);
});

it("releases only its own successful reservation and preserves failures across independent clients", async () => {
  const email = "limits@example.com";
  const failure = await reserveAccess("login", email);
  const success = await reserveAccess("login", email);
  expect(await completeLogin(failure, false)).toBe(true);
  expect(await completeLogin(failure, false)).toBe(false);
  expect(await completeLogin(success, true)).toBe(true);
  const client = await new mongo.MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const row = await client.db(database.name).collection("access_limits").findOne({ _id: accessLimitKey("login", email) as never });
    expect(row!.events).toHaveLength(1);
    expect(row!.events[0].id).toBe(failure.id);
    const attempts = await Promise.all(Array.from({ length: 15 }, () => reserveAccess("login", email)));
    expect(attempts.filter(a => a.allowed)).toHaveLength(9);
    await client.db(database.name).collection("access_limits").updateOne({ _id: accessLimitKey("login", email) as never }, { $set: { "events.$[].until": new Date(0) } });
    expect(await completeLogin(attempts.find(a => a.allowed)!, true)).toBe(false);
    expect((await reserveAccess("login", email)).allowed).toBe(true);
  } finally { await client.close(); }
});

it("enforces concurrent first use across application processes", async () => {
  const script = `const {reserveAccess,completeLogin}=require('./src/server/access-limits.ts');
    Promise.all(Array.from({length:12},()=>reserveAccess('login','processes@example.com')))
    .then(async rows=>{await Promise.all(rows.filter(r=>r.allowed).map(r=>completeLogin(r,false)));
    console.log(rows.filter(r=>r.allowed).length);}).finally(()=>require('mongoose').disconnect());`;
  const results = await Promise.all(Array.from({ length: 2 }, () => promisify(execFile)(process.execPath, ["--conditions=react-server", "--import", "tsx", "-e", script], { env: process.env })));
  expect(results.reduce((sum, result) => sum + Number(result.stdout.trim()), 0)).toBe(10);
  expect((await reserveAccess("login", "processes@example.com")).allowed).toBe(false);
});
