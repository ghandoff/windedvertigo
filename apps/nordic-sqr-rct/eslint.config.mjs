import { createRequire } from "module";
import { defineConfig, globalIgnores } from "eslint/config";

// Use createRequire so CommonJS resolution finds hoisted workspace deps
const require = createRequire(import.meta.url);
const nextVitals = require("eslint-config-next/core-web-vitals");

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
