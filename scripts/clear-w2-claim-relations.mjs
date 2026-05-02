#!/usr/bin/env node
/**
 * One-off: clear claim_prefix + core_benefit relations on all PCS Claims.
 * Used after archiving W1/W2 hand-seeded Prefix/CoreBenefit rows so the
 * re-run backfill treats every claim as a candidate again.
 *
 * Usage: node scripts/clear-w2-claim-relations.mjs [--dry-run]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

for (const candidate of ['.env.local', '.env.local.migration']) {
  const envFile = resolve(projectRoot, candidate);
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    let val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    val = val.replace(/\\n$/, '').trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const dryRun = process.argv.includes('--dry-run');

const { notion } = await import('../src/lib/notion.js');
const { PCS_DB, PROPS } = await import('../src/lib/pcs-config.js');

const P = PROPS.claims;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let all = [];
let cursor = undefined;
do {
  const res = await notion.databases.query({
    database_id: PCS_DB.claims,
    page_size: 100,
    start_cursor: cursor,
  });
  all = all.concat(res.results);
  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);

console.log(`[ok] fetched ${all.length} PCS Claims`);

let cleared = 0;
let skipped = 0;
let failed = 0;
for (const page of all) {
  const props = page.properties;
  const hasPrefix = (props[P.claimPrefix]?.relation || []).length > 0;
  const hasBenefit = (props[P.coreBenefit]?.relation || []).length > 0;
  if (!hasPrefix && !hasBenefit) { skipped++; continue; }

  if (dryRun) {
    console.log(`[dry] would clear ${page.id} (prefix=${hasPrefix} benefit=${hasBenefit})`);
    cleared++;
    continue;
  }

  try {
    await notion.pages.update({
      page_id: page.id,
      properties: {
        [P.claimPrefix]: { relation: [] },
        [P.coreBenefit]: { relation: [] },
      },
    });
    cleared++;
    console.log(`[ok] cleared ${page.id}`);
    await sleep(350);
  } catch (err) {
    failed++;
    console.error(`[fail] ${page.id}: ${err.message}`);
  }
}

console.log(`\nSummary: cleared=${cleared} skipped=${skipped} failed=${failed} (total=${all.length})`);
