import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

// The closure owns one generated database. Callers cannot choose cleanup targets.
export function isolatedDatabase() {
  const name = `whatmeal_test_${randomUUID().replaceAll("-", "")}`;
  const original = { uri: process.env.MONGODB_URI, name: process.env.MONGODB_DB };
  return {
    name,
    configure() {
      process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017";
      process.env.MONGODB_DB = name;
    },
    async cleanup() {
      try {
        if (mongoose.connection.readyState === 1) {
          if (mongoose.connection.name !== name || !/^whatmeal_test_[a-f0-9]{32}$/.test(name)) {
            throw new Error("Unsafe test database cleanup refused");
          }
          await mongoose.connection.dropDatabase();
        }
      } finally {
        await mongoose.disconnect();
        if (original.uri === undefined) delete process.env.MONGODB_URI;
        else process.env.MONGODB_URI = original.uri;
        if (original.name === undefined) delete process.env.MONGODB_DB;
        else process.env.MONGODB_DB = original.name;
      }
    },
  };
}
