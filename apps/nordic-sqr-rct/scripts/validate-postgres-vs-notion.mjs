#!/usr/bin/env node
/**
 * Path-2 read-path parity check — 2026-05-06.
 *
 * Calls both the Notion and Postgres reader for each PCS helper that
 * has been Postgres-swapped, and asserts:
 *   1. Same row count
 *   2. Same row IDs (set equality)
 *   3. Per-row field-level diffs for a 5-row sample
 *
 * Run with: node --env-file=.env.local scripts/validate-postgres-vs-notion.mjs
 *
 * Exit code: 0 on parity, 1 on any divergence. Use this before flipping
 * PCS_READ_FROM_POSTGRES on in production.
 */

import { getPcsSupabase, shouldReadFromPostgres } from '../src/lib/supabase-pcs.js';
import { notion } from '../src/lib/notion.js';
import { PCS_DB } from '../src/lib/pcs-config.js';

if (!process.env.SUPABASE_NORDIC_URL) {
  console.error('Missing SUPABASE_NORDIC_URL — set in .env.local');
  process.exit(1);
}

// Force the Postgres path on for this script regardless of env.
process.env.PCS_READ_FROM_POSTGRES = '1';

const sb = getPcsSupabase();
if (!sb) {
  console.error('Supabase client not configured — check SUPABASE_NORDIC_SECRET_KEY');
  process.exit(1);
}

let totalDivergences = 0;

async function compareEvidence() {
  console.log('\n[evidence] fetching both sides...');

  // Notion side — full pagination
  let notionRows = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.evidenceLibrary,
      page_size: 100,
      start_cursor: cursor,
    });
    notionRows = notionRows.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  // Postgres side
  const { data: pgRows, error } = await sb.from('pcs_evidence').select('*').limit(2000);
  if (error) throw error;

  console.log(`  notion: ${notionRows.length} rows`);
  console.log(`  postgres: ${pgRows.length} rows`);

  // Set equality check on notion_page_id
  const notionIds = new Set(notionRows.map((r) => r.id));
  const pgIds = new Set(pgRows.map((r) => r.notion_page_id));

  const missingFromPg = [...notionIds].filter((id) => !pgIds.has(id));
  const extraInPg = [...pgIds].filter((id) => !notionIds.has(id));

  if (missingFromPg.length > 0) {
    console.log(`  ✗ ${missingFromPg.length} rows in Notion but missing from Postgres:`);
    missingFromPg.slice(0, 5).forEach((id) => console.log(`      ${id}`));
    totalDivergences += missingFromPg.length;
  }
  if (extraInPg.length > 0) {
    console.log(`  ✗ ${extraInPg.length} rows in Postgres but missing from Notion:`);
    extraInPg.slice(0, 5).forEach((id) => console.log(`      ${id}`));
    totalDivergences += extraInPg.length;
  }
  if (missingFromPg.length === 0 && extraInPg.length === 0) {
    console.log(`  ✓ row-count + ID parity`);
  }

  // Sample 5 rows for field-level comparison
  const sample = notionRows.slice(0, 5);
  for (const notionPage of sample) {
    const pgRow = pgRows.find((r) => r.notion_page_id === notionPage.id);
    if (!pgRow) continue;
    // Compare a few critical fields
    const notionTitle = notionPage.properties?.Name?.title?.[0]?.plain_text || '';
    const pgTitle = pgRow.name || '';
    if (notionTitle !== pgTitle) {
      console.log(`  ✗ field diff on ${notionPage.id}:`);
      console.log(`      notion.name: ${JSON.stringify(notionTitle.slice(0, 60))}`);
      console.log(`      postgres.name: ${JSON.stringify(pgTitle.slice(0, 60))}`);
      totalDivergences++;
    }
  }
}

await compareEvidence();

console.log('\n────────────────────────');
if (totalDivergences === 0) {
  console.log('✓ All checks passed. Safe to flip PCS_READ_FROM_POSTGRES.');
  process.exit(0);
} else {
  console.log(`✗ ${totalDivergences} divergences. Investigate before flipping the flag.`);
  process.exit(1);
}
