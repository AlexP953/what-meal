import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { getAuthConfig } from "@/server/config";
import { dbConnect } from "@/server/persistence/connection";

type Kind = "registration" | "login";
type Event = { id: string; at: Date; until: Date; pending: boolean };
type Bucket = { _id: string; events: Event[]; expiresAt: Date; observedAt?: Date };
export type AccessReservation = { key: string; id: string; allowed: boolean; retryAfter: number };
const policies = { registration: { count: 20, window: 3600000 }, login: { count: 10, window: 900000 } };

export function accessLimitKey(kind: Kind, email = ""): string {
  return kind === "registration" ? "registration:shared" : `login:${createHmac("sha256", getAuthConfig().secret).update(email.trim().toLowerCase()).digest("hex")}`;
}

async function buckets() {
  const connection = await dbConnect();
  return connection.connection.db!.collection<Bucket>("access_limits");
}

export async function prepareAccessLimits() {
  const collection = await buckets();
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export async function reserveAccess(kind: Kind, email = ""): Promise<AccessReservation> {
  const collection = await buckets();
  const key = accessLimitKey(kind, email);
  const id = randomUUID();
  const policy = policies[kind];
  try {
    await collection.updateOne({ _id: key }, { $setOnInsert: { events: [], expiresAt: new Date(0) } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  // Single-document pipelines serialize reservations across processes and use the DB clock.
  // https://www.mongodb.com/docs/manual/tutorial/update-documents-with-aggregation-pipeline/
  const row = await collection.findOneAndUpdate({ _id: key }, [
    { $set: { events: { $filter: { input: "$events", as: "e", cond: { $gt: ["$$e.until", "$$NOW"] } } } } },
    { $set: {
      events: { $cond: [{ $lt: [{ $size: "$events" }, policy.count] }, { $concatArrays: ["$events", [{ id, at: "$$NOW", until: { $add: ["$$NOW", kind === "login" ? 60000 : policy.window] }, pending: kind === "login" }]] }, "$events"] },
      expiresAt: { $add: ["$$NOW", policy.window + 60000] },
      observedAt: "$$NOW",
    } },
  ], { returnDocument: "after" });
  // TTL may remove an idle bucket between initialization and reservation. Retry only that race.
  if (!row) return reserveAccess(kind, email);
  const allowed = row.events.some(event => event.id === id);
  return { key, id, allowed, retryAfter: allowed ? 0 : Math.max(1, Math.ceil((Math.min(...row.events.map(e => e.until.getTime())) - row.observedAt!.getTime()) / 1000)) };
}

export async function completeLogin(reservation: AccessReservation, success: boolean): Promise<boolean> {
  if (!reservation.allowed) return false;
  const collection = await buckets();
  const result = await collection.updateOne({ _id: reservation.key, $expr: { $anyElementTrue: { $map: { input: "$events", as: "e", in: { $and: [{ $eq: ["$$e.id", reservation.id] }, "$$e.pending", { $gt: ["$$e.until", "$$NOW"] }] } } } } }, [
    { $set: {
      events: success
        ? { $filter: { input: "$events", as: "e", cond: { $ne: ["$$e.id", reservation.id] } } }
        : { $map: { input: "$events", as: "e", in: { $cond: [{ $eq: ["$$e.id", reservation.id] }, { id: reservation.id, at: "$$NOW", until: { $add: ["$$NOW", policies.login.window] }, pending: false }, "$$e"] } } },
      expiresAt: { $add: ["$$NOW", policies.login.window + 60000] },
    } },
  ]);
  return result.modifiedCount === 1;
}
