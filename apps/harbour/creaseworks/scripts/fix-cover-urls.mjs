/**
 * One-shot DB migration: rewrite cover_url references that point at the
 * old anotheroption-account R2 public URL onto the new garrett-account
 * public URL. Creaseworks edition — covers all *_cache + collections tables.
 *
 * Usage:
 *   POSTGRES_URL=... node scripts/fix-cover-urls.mjs
 */

import { neon } from "@neondatabase/serverless";

const OLD_HASH = "pub-c685a810f5794314a106e0f249c740c9";
const NEW_HASH = "pub-60282cf378c248cf9317acfb691f6c99";

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is required");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  // Tables with cover_url columns (discovered via information_schema)
  const targets = [
    { table: "playdates_cache", col: "cover_url" },
    { table: "packs_cache", col: "cover_url" },
    { table: "collections", col: "cover_url" },
    { table: "vault_activities_cache", col: "cover_url" },
  ];

  let totalFixed = 0;
  const pattern = `%${OLD_HASH}%`;

  for (const { table, col } of targets) {
    let before, after;
    if (table === "playdates_cache") {
      [{ n: before }] = await sql`SELECT COUNT(*)::int AS n FROM playdates_cache WHERE cover_url LIKE ${pattern}`;
      if (before > 0) await sql`UPDATE playdates_cache SET cover_url = REPLACE(cover_url, ${OLD_HASH}, ${NEW_HASH}) WHERE cover_url LIKE ${pattern}`;
      [{ n: after }] = await sql`SELECT COUNT(*)::int AS n FROM playdates_cache WHERE cover_url LIKE ${pattern}`;
    } else if (table === "packs_cache") {
      [{ n: before }] = await sql`SELECT COUNT(*)::int AS n FROM packs_cache WHERE cover_url LIKE ${pattern}`;
      if (before > 0) await sql`UPDATE packs_cache SET cover_url = REPLACE(cover_url, ${OLD_HASH}, ${NEW_HASH}) WHERE cover_url LIKE ${pattern}`;
      [{ n: after }] = await sql`SELECT COUNT(*)::int AS n FROM packs_cache WHERE cover_url LIKE ${pattern}`;
    } else if (table === "collections") {
      [{ n: before }] = await sql`SELECT COUNT(*)::int AS n FROM collections WHERE cover_url LIKE ${pattern}`;
      if (before > 0) await sql`UPDATE collections SET cover_url = REPLACE(cover_url, ${OLD_HASH}, ${NEW_HASH}) WHERE cover_url LIKE ${pattern}`;
      [{ n: after }] = await sql`SELECT COUNT(*)::int AS n FROM collections WHERE cover_url LIKE ${pattern}`;
    } else if (table === "vault_activities_cache") {
      [{ n: before }] = await sql`SELECT COUNT(*)::int AS n FROM vault_activities_cache WHERE cover_url LIKE ${pattern}`;
      if (before > 0) await sql`UPDATE vault_activities_cache SET cover_url = REPLACE(cover_url, ${OLD_HASH}, ${NEW_HASH}) WHERE cover_url LIKE ${pattern}`;
      [{ n: after }] = await sql`SELECT COUNT(*)::int AS n FROM vault_activities_cache WHERE cover_url LIKE ${pattern}`;
    } else continue;

    const fixed = before - after;
    totalFixed += fixed;
    if (before > 0) {
      console.log(`  ${fixed > 0 ? "✓" : "·"} ${table}.${col}: ${fixed} fixed (${after} remain)`);
    } else {
      console.log(`  - ${table}.${col}: no old-hash rows`);
    }
  }

  console.log(`[fix-cover-urls] total fixed: ${totalFixed}`);
}

main().catch((err) => {
  console.error("[fix-cover-urls] fatal:", err);
  process.exit(1);
});
