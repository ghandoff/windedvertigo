import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "..", "dist");
mkdirSync(distDir, { recursive: true });

const payload = {
  app: "values-auction",
  sha: process.env.BUILD_SHA ?? "dev",
  ref: process.env.BUILD_REF ?? "unknown",
  built: process.env.BUILD_TIME ?? new Date().toISOString(),
};

writeFileSync(join(distDir, "version.json"), JSON.stringify(payload, null, 2) + "\n");
console.log("wrote dist/version.json:", payload);
