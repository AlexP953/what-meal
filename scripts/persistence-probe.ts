import assert from "node:assert/strict";
import mongoose from "mongoose";
import { dbConnect } from "../src/server/persistence/connection";
import { User } from "../src/server/persistence/user";
import { Meal } from "../src/server/persistence/meal";

async function main() {
  // Refuse external destinations even when invoked outside verify-local.sh.
  assert.match(process.env.MONGODB_URI ?? "", /^mongodb:\/\/127\.0\.0\.1:\d+$/);
  assert.match(process.env.MONGODB_DB ?? "", /^whatmeal_verify_[a-f0-9]{32}$/);
  const mode = process.argv[2];
  assert.ok(mode === "seed" || mode === "read");
  try {
    await dbConnect();
    assert.equal(await User.countDocuments(), 0);
    assert.equal(await Meal.countDocuments(), 0);
    const probes = mongoose.connection.collection<{ _id: string; marker: string }>("verification_probes");
    if (mode === "seed") {
      assert.equal(await probes.countDocuments(), 0);
      await probes.insertOne({ _id: "installation", marker: "survives-restarts" });
    }
    assert.equal((await probes.findOne({ _id: "installation" }))?.marker, "survives-restarts");
    console.log(`Persistence probe ${mode} passed (no accounts or meals).`);
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  console.error("Isolated persistence probe failed");
  process.exitCode = 1;
});
