#!/usr/bin/env node
/**
 * One-shot migration runner for migrations 028–033.
 * Run from apps/creaseworks/:
 *   node scripts/apply-migrations-028-032.mjs
 *
 * Uses @neondatabase/serverless (already in project deps).
 * Splits multi-statement files into individual statements since the
 * Neon HTTP driver sends one statement at a time.
 */

import { readFileSync } from "fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const connStr = process.env.POSTGRES_URL;

if (!connStr) {
  console.error("❌  No POSTGRES_URL found in .env.local");
  process.exit(1);
}

const sql = neon(connStr);

const migrations = [
  "migrations/028-reflection-credits.sql",
  "migrations/029-photo-consents.sql",
  "migrations/030-leaderboard.sql",
  "migrations/031-tinkering-tier.sql",
  "migrations/032_cover_images.sql",
  "migrations/033_stripe_price_id.sql",
];

/** Split a SQL file into individual statements, ignoring comments and blanks. */
function splitStatements(text) {
  // Strip comments BEFORE splitting so semicolons inside comments
  // (e.g. "hashed for security; prefixes used…") don't cause false splits.
  const stripped = text.replace(/--.*$/gm, "");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

console.log("🔌  Connecting to Neon…\n");

for (const file of migrations) {
  const raw = readFileSync(file, "utf8");
  const stmts = splitStatements(raw);
  const label = file.replace("migrations/", "");

  let skipped = false;
  for (const stmt of stmts) {
    try {
      await sql(stmt);
    } catch (err) {
      if (
        err.message?.includes("already exists") ||
        err.code === "42710" || // duplicate_object
        err.code === "42701"    // duplicate_column
      ) {
        skipped = true;
        continue; // already applied, keep going
      }
      console.error(`❌  ${label} — ${err.message}`);
      console.error(`    Statement: ${stmt.slice(0, 120)}…`);
      process.exit(1);
    }
  }
  console.log(skipped ? `⏭️  ${label} — already applied` : `✅  ${label}`);
}

// Quick verify
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('reflection_credits','credit_redemptions','photo_consents','partner_api_keys')
  ORDER BY table_name;
`;
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'playdates_cache'
    AND column_name IN ('tinkering_tier','cover_url','cover_r2_key')
  ORDER BY column_name;
`;
const catCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'packs_catalogue'
    AND column_name = 'stripe_price_id'
  ORDER BY column_name;
`;
const stripePrices = await sql`
  SELECT pack_cache_id, stripe_price_id FROM packs_catalogue
  WHERE stripe_price_id IS NOT NULL
  ORDER BY pack_cache_id;
`;
const userCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name IN ('leaderboard_opted_in','leaderboard_display_name')
  ORDER BY column_name;
`;

console.log("\n— Verification —");
console.log(`New tables: ${tables.map((r) => r.table_name).join(", ") || "NONE ⚠️"}`);
console.log(`playdates_cache columns: ${cols.map((r) => r.column_name).join(", ") || "NONE ⚠️"}`);
console.log(`users columns: ${userCols.map((r) => r.column_name).join(", ") || "NONE ⚠️"}`);
console.log(`packs_catalogue.stripe_price_id: ${catCols.length ? "✅ exists" : "MISSING ⚠️"}`);
console.log(`stripe prices seeded: ${stripePrices.length} of 6`);
console.log("\n🎉  Migrations 028–033 complete!");
