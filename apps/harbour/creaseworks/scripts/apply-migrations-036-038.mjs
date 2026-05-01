#!/usr/bin/env node
/**
 * One-shot migration runner for migrations 036–038.
 * Run from apps/creaseworks/:
 *   node scripts/apply-migrations-036-038.mjs
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
  "migrations/036_rich_content.sql",
  "migrations/037_material_emoji.sql",
  "migrations/038_rich_text_html_columns.sql",
];

/** Split a SQL file into individual statements, ignoring comments and blanks. */
function splitStatements(text) {
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
        continue;
      }
      console.error(`❌  ${label} — ${err.message}`);
      console.error(`    Statement: ${stmt.slice(0, 120)}…`);
      process.exit(1);
    }
  }
  console.log(skipped ? `⏭️  ${label} — already applied` : `✅  ${label}`);
}

// Quick verify — check that all new columns exist
const playdateCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'playdates_cache'
    AND column_name IN (
      'body_html', 'find_html', 'fold_html', 'unfold_html',
      'illustration_r2_key', 'illustration_url', 'emoji',
      'headline_html', 'find_again_prompt_html', 'substitutions_notes_html'
    )
  ORDER BY column_name;
`;
const packCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'packs_cache'
    AND column_name IN ('body_html', 'description_html')
  ORDER BY column_name;
`;
const collCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'collections'
    AND column_name IN ('body_html', 'description_html')
  ORDER BY column_name;
`;
const materialCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'materials_cache'
    AND column_name = 'emoji'
  ORDER BY column_name;
`;
const cmsTables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'cms_pages'
`;

console.log("\n— Verification —");
console.log(`playdates_cache new cols: ${playdateCols.map((r) => r.column_name).join(", ") || "NONE ⚠️"}`);
console.log(`packs_cache new cols: ${packCols.map((r) => r.column_name).join(", ") || "NONE ⚠️"}`);
console.log(`collections new cols: ${collCols.map((r) => r.column_name).join(", ") || "NONE ⚠️"}`);
console.log(`materials_cache.emoji: ${materialCols.length ? "✅ exists" : "MISSING ⚠️"}`);
console.log(`cms_pages table: ${cmsTables.length ? "✅ exists" : "MISSING ⚠️"}`);
console.log("\n🎉  Migrations 036–038 complete!");
