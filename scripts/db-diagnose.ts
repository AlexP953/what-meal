import mongoose from "mongoose";
import { dbConnect } from "../src/server/persistence/connection";

async function main() {
  try {
    try {
      const { connection } = await dbConnect();
      const collections = connection.db?.listCollections(
        { name: "meals" },
        { nameOnly: true, signal: AbortSignal.timeout(5000) },
      );
      if (!await collections?.hasNext()) throw new Error("Missing meals collection");
    } finally {
      await mongoose.disconnect();
    }
    console.log("MongoDB application access OK");
  } catch {
    console.error("MongoDB application access failed");
    process.exitCode = 1;
  }
}

void main();
