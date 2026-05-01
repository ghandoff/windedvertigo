/**
 * Run a single migration file against the shared Neon DB.
 *
 * Usage:
 *   cd apps/creaseworks
 *   npx tsx scripts/run-migration.ts migrations/050_harbour_commerce.sql
 *
 * Reads POSTGRES_URL from .env.local (non-pooled recommended for DDL).
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// load .env.local before importing @vercel/postgres
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const raw = trimmed.slice(eqIdx + 1).trim();
    // strip surrounding quotes
    const val = raw.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("loaded .env.local");
} catch {
  console.warn("no .env.local found — using process env");
}

import { sql } from "@vercel/postgres";

const migrationArg = process.argv[2];
if (!migrationArg) {
  console.error("usage: npx tsx scripts/run-migration.ts <path-to-migration.sql>");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), migrationArg);
const migration = readFileSync(sqlPath, "utf-8");

// strip comments, split on semicolons
const cleaned = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = cleaned
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function main() {
  console.log(`running ${migrationArg} (${statements.length} statements)\n`);
  for (let i = 0; i < statements.length; i++) {
    const preview = statements[i].slice(0, 80).replace(/\s+/g, " ");
    console.log(`[${i + 1}/${statements.length}] ${preview}`);
    try {
      await sql.query(statements[i]);
      console.log("    ok");
    } catch (err: any) {
      console.error("    FAILED: " + err.message);
      process.exit(1);
    }
  }
  console.log("\nmigration complete.");
  process.exit(0);
}

main();
