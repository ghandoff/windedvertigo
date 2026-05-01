#!/usr/bin/env node
// One-shot runner for migration 054 (stripe_webhook_events table).
// Run from apps/creaseworks/: node scripts/apply-migration-054.mjs
// Idempotent — uses CREATE TABLE/INDEX IF NOT EXISTS so re-runs are safe.

import { readFileSync } from "fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const connStr = process.env.POSTGRES_URL;
if (!connStr) {
  console.error("missing POSTGRES_URL in .env.local");
  process.exit(1);
}

const sql = neon(connStr);
const file = "migrations/054_stripe_webhook_events.sql";
const raw = readFileSync(file, "utf8");

const stmts = raw
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`migration 054: ${stmts.length} statements`);
for (let i = 0; i < stmts.length; i++) {
  const preview = stmts[i].slice(0, 60).replace(/\s+/g, " ");
  console.log(`  [${i + 1}/${stmts.length}] ${preview}…`);
  try {
    await sql(stmts[i]);
    console.log("    ok");
  } catch (err) {
    console.error(`    failed: ${err.message}`);
    process.exit(1);
  }
}

const check = await sql(
  "SELECT to_regclass('public.stripe_webhook_events') AS exists, " +
  "(SELECT COUNT(*) FROM stripe_webhook_events) AS row_count"
);
console.log(`\nverified: stripe_webhook_events present, ${check[0].row_count} rows`);
