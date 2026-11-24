import { describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import dns from "node:dns";
import { getDatabaseConfig, getAuthConfig } from "@/server/config";

describe("private configuration", () => {
  it.each([
    "mongodb:///", "mongodb://:27017", "mongodb://localhost:invalid",
    "mongodb://localhost:70000", "mongodb://sensitive:credential@/",
    "mongodb+srv://localhost:27017", "mongodb+srv://one.example,two.example",
    "mongodb://user:unescaped@password@host", "mongodb://localhost/?tls=invalid",
  ])("rejects malformed MongoDB syntax without revealing input: %s", (uri) => {
    expect(() => getDatabaseConfig({ MONGODB_URI: uri, MONGODB_DB: "local" }))
      .toThrow(/^Invalid or missing MONGODB_URI$/);
  });
  it("accepts driver URI formats without connecting or resolving DNS", () => {
    const connect = vi.spyOn(mongoose.mongo.MongoClient.prototype, "connect");
    const resolve = vi.spyOn(dns.promises, "resolveSrv");
    try {
      for (const uri of [
        "mongodb://127.0.0.1:27017", "mongodb://[::1]:27017",
        "mongodb://user:p%40ss%3Aword@localhost:27017/?authSource=admin",
        "mongodb://one.example:27017,two.example:27018/?replicaSet=local",
        "mongodb+srv://user:p%40ss@cluster.example.test/?retryWrites=true",
      ]) {
        expect(getDatabaseConfig({ MONGODB_URI: uri, MONGODB_DB: "local" }).uri).toBe(uri);
      }
      expect(connect).not.toHaveBeenCalled();
      expect(resolve).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });
  it("validates components independently", () => {
    expect(getDatabaseConfig({ MONGODB_URI: "mongodb://127.0.0.1:27017", MONGODB_DB: "whatmeal" })).toEqual({ uri: "mongodb://127.0.0.1:27017", dbName: "whatmeal" });
    expect(getAuthConfig({ AUTH_SECRET: "a".repeat(48) })).toEqual({ secret: "a".repeat(48) });
  });
  it.each([
    [{}, "MONGODB_URI"],
    [{ MONGODB_URI: "https://sensitive:credential@host", MONGODB_DB: "local" }, "MONGODB_URI"],
    [{ MONGODB_URI: "mongodb://localhost:27017" }, "MONGODB_DB"],
    [{ MONGODB_URI: "mongodb://localhost:27017", MONGODB_DB: "private/invalid" }, "MONGODB_DB"],
  ])("reports the invalid database variable without its value", (env, name) => {
    expect(() => getDatabaseConfig(env)).toThrow(`Invalid or missing ${name}`);
    try { getDatabaseConfig(env); } catch (error) {
      expect(String(error)).not.toMatch(/sensitive|credential|private\/invalid/);
    }
  });
  it.each([undefined, "", "private-short-secret"])("rejects missing and short auth secrets", (secret) => {
    expect(() => getAuthConfig({ AUTH_SECRET: secret })).toThrow("Invalid or missing AUTH_SECRET");
    try { getAuthConfig({ AUTH_SECRET: secret }); } catch (error) {
      expect(String(error)).not.toContain("private-short-secret");
    }
  });
});
