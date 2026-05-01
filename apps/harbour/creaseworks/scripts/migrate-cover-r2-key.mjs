/**
 * Phase 7.1 — read-time cover URL construction.
 *
 * Mirrors the vault Phase 7.1 migration. Ensures every cache table that
 * stores a cover image has a `cover_r2_key` column populated, so queries
 * can compute `cover_url` at read time from `R2_PUBLIC_URL` + key.
 * Future R2 bucket migrations then only require an env-var update —
 * no DB migration.
 *
 * Steps (per table):
 *   1. ALTER TABLE … ADD COLUMN IF NOT EXISTS cover_r2_key TEXT
 *      (idempotent — does nothing if column already exists, which is the
 *      case for creaseworks since migrations 032 and 034 already added it.
 *      Kept here for parity with the vault migration so this script is
 *      self-contained.)
 *   2. Backfill cover_r2_key from cover_url for any row missing the key.
 *      The key is the path after R2_PUBLIC_URL (the public bucket origin).
 *      Idempotent — only updates rows where cover_r2_key IS NULL.
 *
 * Usage:
 *   POSTGRES_URL=... R2_PUBLIC_URL=https://pub-…r2.dev \
 *     node scripts/migrate-cover-r2-key.mjs
 *
 * Tables covered:
 *   - playdates_cache
 *   - packs_cache
 *   - collections
 *   - vault_activities_cache
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is required");
  process.exit(1);
}

// R2_PUBLIC_URL is the bucket origin (e.g. https://pub-…r2.dev).
// Backfill strips this prefix from cover_url to produce cover_r2_key.
const r2PublicUrl = process.env.R2_PUBLIC_URL;
if (!r2PublicUrl) {
  console.error(
    "R2_PUBLIC_URL is required (e.g. https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev)",
  );
  process.exit(1);
}

const sql = neon(url);

const TABLES = [
  "playdates_cache",
  "packs_cache",
  "collections",
  "vault_activities_cache",
];

async function ensureColumn(table) {
  // ADD COLUMN IF NOT EXISTS — Postgres is happy to no-op when the column
  // already exists, so this is safe to re-run.
  await sql.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS cover_r2_key TEXT`,
  );
}

async function backfillTable(table) {
  // Strip the bucket origin (and a trailing slash, if any) from cover_url
  // and write the remaining path to cover_r2_key. Only touches rows where:
  //   - cover_r2_key IS NULL (don't clobber sync-written values)
  //   - cover_url IS NOT NULL (no source to backfill from)
  //   - cover_url starts with R2_PUBLIC_URL (don't touch foreign URLs)
  const prefixWithSlash = r2PublicUrl.endsWith("/")
    ? r2PublicUrl
    : `${r2PublicUrl}/`;
  const likePattern = `${r2PublicUrl}%`;

  const before = await sql.query(
    `SELECT COUNT(*)::int AS n FROM ${table}
     WHERE cover_r2_key IS NULL
       AND cover_url IS NOT NULL
       AND cover_url LIKE $1`,
    [likePattern],
  );
  const candidates = before.rows[0]?.n ?? 0;

  if (candidates === 0) {
    console.log(`  · ${table}: nothing to backfill`);
    return 0;
  }

  // Use a regex-safe substring strip — substring(cover_url from length(prefix)+1)
  // works regardless of special chars in the URL.
  const result = await sql.query(
    `UPDATE ${table}
     SET cover_r2_key = SUBSTRING(cover_url FROM LENGTH($1) + 1)
     WHERE cover_r2_key IS NULL
       AND cover_url IS NOT NULL
       AND cover_url LIKE $2`,
    [prefixWithSlash, likePattern],
  );
  const updated = result.rowCount ?? 0;
  console.log(`  ✓ ${table}: backfilled ${updated} of ${candidates} rows`);
  return updated;
}

async function main() {
  console.log("[migrate-cover-r2-key] ensuring columns…");
  for (const t of TABLES) {
    try {
      await ensureColumn(t);
    } catch (err) {
      // If the table itself doesn't exist, log and skip — keeps the script
      // safe to run against partial deployments.
      console.warn(
        `  - ${t}: skipped (${err instanceof Error ? err.message : err})`,
      );
    }
  }

  console.log("[migrate-cover-r2-key] backfilling cover_r2_key…");
  let total = 0;
  for (const t of TABLES) {
    try {
      total += await backfillTable(t);
    } catch (err) {
      console.warn(
        `  - ${t}: skipped (${err instanceof Error ? err.message : err})`,
      );
    }
  }

  console.log(`[migrate-cover-r2-key] done — ${total} row(s) backfilled.`);
}

main().catch((err) => {
  console.error("[migrate-cover-r2-key] fatal:", err);
  process.exit(1);
});
