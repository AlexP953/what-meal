import mongoose from "mongoose";
import { prepareDatabase } from "../src/server/persistence/prepare";

async function main() {
  try {
    await prepareDatabase();
    console.log("Database prepared.");
  } catch (error) {
    const message = error instanceof Error && /^Invalid or missing MONGODB_(URI|DB)$/.test(error.message)
      ? error.message : "Database preparation failed";
    console.error(message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void main();
