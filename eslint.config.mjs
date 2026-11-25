import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Use compatible plugins directly, without eslint-config-next's older peers.
export default defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "@next/next": next, "react-hooks": hooks },
    rules: { ...next.configs["core-web-vitals"].rules, ...hooks.configs.recommended.rules },
  },
  { files: ["public/*.js"], languageOptions: { globals: globals.serviceworker } },
]);
