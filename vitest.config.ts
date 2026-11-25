import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    conditions: ["react-server"],
  },
  ssr: { resolve: { conditions: ["react-server"], externalConditions: ["react-server"] } },
  test: {
    execArgv: ["--conditions=react-server"],
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 15000,
          hookTimeout: 15000,
        },
      },
    ],
  },
});
