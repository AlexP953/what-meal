import { describe, expect, it } from "vitest";
import { getDatabaseConfig, getAuthConfig } from "@/server/config";

describe("private configuration", () => {
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
