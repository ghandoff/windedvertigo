#!/usr/bin/env node
/**
 * Backfill Canonical Claim identity keys.
 *
 * Wave 7.0.5 T2 — added 2026-04-21.
 *
 * For every existing Canonical Claim row, resolve the linked Claim Prefix's
 * `Dose sensitivity` select, compute the deterministic `Canonical key` per
 * src/lib/canonical-claim-key.js, and write both the key and the
 * `Dose sensitivity applied` select back onto the row.
 *
 * This pass is ADDITIVE only — we do NOT merge duplicate canonical claims
 * here. After the backfill runs, rows sharing a key are surfaced in the
 * summary for eyeball review; actual merging is a follow-up ticket (T8 / a
 * subsequent T2.x ticket).
 *
 * Usage:
 *   node scripts/backfill-canonical-claim-keys.mjs --dry-run
 *   node scripts/backfill-canonical-claim-keys.mjs --dry-run --limit=10
 *   node scripts/backfill-canonical-claim-keys.mjs            # live write
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Env loading (same pattern as other backfills) ────────────────────────
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

const required = ['NOTION_TOKEN', 'NOTION_PCS_CANONICAL_CLAIMS_DB', 'NOTION_PCS_PREFIXES_DB'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing required env: ${k}`);
    process.exit(1);
  }
}

// ─── Args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
let limit = null;
for (const a of args) {
  const m = a.match(/^--limit=(\d+)$/);
  if (m) limit = Number(m[1]);
}

// ─── Imports ──────────────────────────────────────────────────────────────
const { notion } = await import('../src/lib/notion.js');
const { PCS_DB, PROPS } = await import('../src/lib/pcs-config.js');
const { getAllPrefixes } = await import('../src/lib/pcs-prefixes.js');
const {
  computeCanonicalClaimKey,
  coerceDoseSensitivity,
  DOSE_SENSITIVITY,
} = await import('../src/lib/canonical-claim-key.js');

const CC = PROPS.canonicalClaims;

// ─── Helpers ──────────────────────────────────────────────────────────────
async function getAllCanonicalClaimPages() {
  const out = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.canonicalClaims,
      page_size: 100,
      start_cursor: cursor,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

function pickRelationId(prop) {
  return prop?.relation?.[0]?.id || null;
}

function firstRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('') || null;
}

// ─── Main ─────────────────────────────────────────────────────────────────
console.log('\n=== Backfill Canonical Claim keys ===');
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (limit) console.log(`Limit: ${limit} canonical claims`);
console.log('');

// Build prefix lookup once (cached underneath anyway).
const prefixes = await getAllPrefixes();
const prefixById = new Map(prefixes.map(p => [p.id, p]));
const prefixByIdNoDash = new Map(
  prefixes.map(p => [p.id.replace(/-/g, ''), p]),
);
console.log(`Loaded ${prefixes.length} prefixes.`);

function lookupPrefix(id) {
  if (!id) return null;
  return prefixById.get(id) || prefixByIdNoDash.get(id.replace(/-/g, '')) || null;
}

const pages = await getAllCanonicalClaimPages();
console.log(`Loaded ${pages.length} canonical claims.`);

const work = limit ? pages.slice(0, limit) : pages;

const byKey = new Map(); // key -> [{ id, title, sensitivity }]
const sensitivityCounts = {
  [DOSE_SENSITIVITY.GATED]: 0,
  [DOSE_SENSITIVITY.AGNOSTIC]: 0,
  [DOSE_SENSITIVITY.QUALIFIED]: 0,
  [DOSE_SENSITIVITY.NOT_APPLICABLE]: 0,
};

const results = { processed: 0, updated: 0, skipped: 0, failed: [] };

for (const page of work) {
  results.processed++;
  const props = page.properties;
  const title =
    (props[CC.canonicalClaim]?.title || []).map(t => t.plain_text).join('') || '(untitled)';
  const prefixId = pickRelationId(props[CC.claimPrefix]);
  const coreBenefitId = pickRelationId(props[CC.coreBenefit]);
  const activeIngredientId = pickRelationId(props[CC.activeIngredient]);
  const existingKey = firstRichText(props[CC.canonicalKey]);

  const prefix = lookupPrefix(prefixId);
  const sensitivity = coerceDoseSensitivity(prefix?.doseSensitivity || null);
  sensitivityCounts[sensitivity] = (sensitivityCounts[sensitivity] || 0) + 1;

  // Canonical claim rows don't carry dose on the row itself (dose lives on
  // Claim Dose Requirements + PCS Claims). For the backfill we compute the
  // dose-agnostic shape of the key — the key shape is still stable because
  // the sensitivity tag is baked in. Claims created via createClaim() will
  // compute their own keys with dose included where applicable, and we
  // converge on the no-dose shape for the canonical row itself.
  const key = computeCanonicalClaimKey({
    prefixId,
    prefixDoseSensitivity: sensitivity,
    coreBenefitId,
    activeIngredientId,
  });

  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push({ id: page.id, title, sensitivity });

  const properties = {
    [CC.canonicalKey]: { rich_text: [{ text: { content: key } }] },
    [CC.doseSensitivityApplied]: { select: { name: sensitivity } },
  };

  const unchanged = existingKey === key &&
    props[CC.doseSensitivityApplied]?.select?.name === sensitivity;

  if (unchanged) {
    results.skipped++;
    continue;
  }

  if (dryRun) {
    console.log(`  [dry] ${title.slice(0, 60)}  →  ${key}  (${sensitivity})`);
    results.updated++;
    continue;
  }

  try {
    await notion.pages.update({ page_id: page.id, properties });
    results.updated++;
    console.log(`  ok  ${title.slice(0, 60)}  →  ${sensitivity}`);
  } catch (err) {
    results.failed.push({ id: page.id, title, reason: err?.message || String(err) });
    console.log(`  FAIL  ${title.slice(0, 60)}: ${err?.message || err}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────
const duplicateGroups = [...byKey.entries()]
  .filter(([, rows]) => rows.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log('\n=== Summary ===');
console.log(JSON.stringify({
  processed: results.processed,
  updated: results.updated,
  skipped: results.skipped,
  failed: results.failed.length,
  sensitivityCounts,
  duplicateGroupCount: duplicateGroups.length,
  duplicateRowCount: duplicateGroups.reduce((s, [, r]) => s + r.length, 0),
}, null, 2));

if (duplicateGroups.length) {
  console.log('\n=== Sample duplicate canonical-key groups (candidates for merging) ===');
  for (const [key, rows] of duplicateGroups.slice(0, 10)) {
    console.log(`\n  key: ${key}  (${rows.length} rows, sensitivity=${rows[0].sensitivity})`);
    for (const r of rows) {
      console.log(`    - ${r.id}  ${r.title.slice(0, 70)}`);
    }
  }
  if (duplicateGroups.length > 10) {
    console.log(`\n  …and ${duplicateGroups.length - 10} more duplicate groups.`);
  }
}

if (results.failed.length) {
  console.log('\n=== Failures ===');
  for (const f of results.failed) {
    console.log(`  ${f.id} (${f.title.slice(0, 60)}): ${f.reason}`);
  }
  process.exit(1);
}
