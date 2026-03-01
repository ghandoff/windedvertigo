#!/usr/bin/env node
/**
 * Seed campaign_tags on sampler playdates.
 *
 * Each playdate gets tags matching its theme/setting so it appears
 * in the seasonal banner during the appropriate seasons.
 *
 * Tag overlap mapping (via PostgreSQL && operator):
 *   spring  → spring, outdoor, garden, rainy-day, planting
 *   summer  → summer, outdoor, water, beach, heat
 *   fall    → fall, autumn, harvest, halloween, leaves
 *   winter  → winter, holiday, indoor, cozy, snow
 *
 * Usage: node scripts/seed-campaign-tags.mjs
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const connStr = process.env.POSTGRES_URL;
if (!connStr) {
  console.error("❌  No POSTGRES_URL found in .env.local");
  process.exit(1);
}

const sql = neon(connStr);

/**
 * Playdate slug → campaign tags, derived from content analysis:
 *
 * cloud cartographer    — sky watching, outdoor → spring/summer/fall
 * function tag scavenger — finding nearby things → spring/summer
 * kek loop micro        — quick indoor experiment → spring (rainy-day) / winter
 * leaf press telegraph  — uses leaves, outdoor → spring/summer/fall
 * shadow tracker        — sun tracking, outdoor → spring/summer
 * transfer test         — material exploration, indoor → winter
 */
const tagMap = {
  "cloud-cartographer": ["outdoor", "spring", "fall"],
  "function-tag-scavenger": ["outdoor", "spring", "summer"],
  "kek-loop-micro-experience": ["indoor", "cozy", "rainy-day"],
  "leaf-press-telegraph": ["fall", "autumn", "leaves", "garden", "outdoor"],
  "shadow-tracker": ["outdoor", "summer", "spring"],
  "transfer-test-find-again": ["indoor", "cozy", "winter"],
};

let updated = 0;
let skipped = 0;

for (const [slug, tags] of Object.entries(tagMap)) {
  const result = await sql(
    `UPDATE playdates_cache
       SET campaign_tags = $1::text[]
     WHERE slug = $2
       AND release_channel = 'sampler'
     RETURNING slug, title`,
    [tags, slug],
  );

  if (result.length > 0) {
    console.log(`  ✅ ${result[0].slug} → ${JSON.stringify(tags)}`);
    updated++;
  } else {
    console.log(`  ⚠️  ${slug} — not found or not sampler`);
    skipped++;
  }
}

console.log(`\n🏷️  Done: ${updated} updated, ${skipped} skipped`);
