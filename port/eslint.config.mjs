import { createRequire } from "module";
import { defineConfig, globalIgnores } from "eslint/config";

// Use createRequire so CommonJS resolution finds hoisted workspace deps
const require = createRequire(import.meta.url);
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTs = require("eslint-config-next/typescript");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores and add workspace-specific ones.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
  // Relax rules that are too strict for the current codebase.
  // These can be tightened incrementally as the code improves.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
