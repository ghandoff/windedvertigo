/**
 * One-shot DB migration: rewrite cover_url + cover_r2_key references that
 * still point at the old anotheroption-account R2 public URL onto the new
 * garrett-account public URL.
 *
 * Triggered by the CF account consolidation: the bucket was migrated but
 * its r2.dev public URL is unique per bucket per account, so the new
 * bucket got pub-60282cf3... while the old pub-c685a810... 401s.
 *
 * Usage (from apps/vertigo-vault/):
 *   POSTGRES_URL=... node scripts/fix-cover-urls.mjs
 *
 * Or:
 *   npx dotenv -e .env.local -- node scripts/fix-cover-urls.mjs
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
  // Count affected rows first
  const [{ before }] = await sql`
    SELECT COUNT(*)::int AS before
    FROM vault_activities_cache
    WHERE cover_url LIKE ${"%" + OLD_HASH + "%"}
  `;
  console.log(`[fix-cover-urls] rows with old hash: ${before}`);

  if (before === 0) {
    console.log("[fix-cover-urls] nothing to do");
    return;
  }

  const result = await sql`
    UPDATE vault_activities_cache
    SET cover_url = REPLACE(cover_url, ${OLD_HASH}, ${NEW_HASH})
    WHERE cover_url LIKE ${"%" + OLD_HASH + "%"}
  `;
  console.log("[fix-cover-urls] update result:", result);

  const [{ after }] = await sql`
    SELECT COUNT(*)::int AS after
    FROM vault_activities_cache
    WHERE cover_url LIKE ${"%" + OLD_HASH + "%"}
  `;
  console.log(`[fix-cover-urls] remaining old-hash rows: ${after}`);
  console.log(`[fix-cover-urls] fixed: ${before - after}`);
}

main().catch((err) => {
  console.error("[fix-cover-urls] fatal:", err);
  process.exit(1);
});
