/**
 * Run database migrations against Vercel Postgres.
 *
 * Run:  npx tsx scripts/run-migrations.ts
 *
 * Loads .env.local automatically so POSTGRES_URL is available
 * outside of Next.js runtime (which handles this on its own).
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local so @vercel/postgres can find POSTGRES_URL
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("no .env.local found — relying on existing env vars");
}

import { runMigrations } from "@/lib/db";

async function main() {
  console.log("running migrations…");
  await runMigrations();
  console.log("migrations complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
