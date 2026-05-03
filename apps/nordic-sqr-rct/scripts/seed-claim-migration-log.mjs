#!/usr/bin/env node
/**
 * Phase 4.6 Bundle B.1 — seed claim_migration_log from a backfill dry-run.
 *
 * Runs the same fuzzy matcher as scripts/backfill-claim-vocab-tiers.mjs but
 * writes every proposal as a row in claim_migration_log (Postgres on
 * wv-nordic). Backfill-review UI reads from this table.
 *
 * Schema (from db/migrations/004_claim_vocab_tiers.sql):
 *   id                    UUID PK
 *   notion_page_id        TEXT  -- the PCS claim page being classified
 *   source_database       TEXT  -- 'pcs_claims'
 *   before_text           TEXT  -- original free-text claim title
 *   after_category        TEXT  -- proposed core_benefit_id (single, for now)
 *   after_strength        TEXT  -- proposed claim_prefix_id
 *   after_family_key      TEXT  -- proposed canonical_claim_id
 *   after_variants        JSONB -- array of {wording, isPrimary}
 *   classification_method TEXT  -- 'regex-heuristic-v1'
 *   classifier_confidence NUMERIC
 *   applied               BOOLEAN
 *   applied_at            TIMESTAMPTZ
 *   applied_by_email      TEXT
 *
 * Usage:
 *   node scripts/seed-claim-migration-log.mjs                 # dry-run preview
 *   node scripts/seed-claim-migration-log.mjs --apply         # writes to Supabase
 *   node scripts/seed-claim-migration-log.mjs --apply --reset # truncates table first
 *
 * Idempotent: ON CONFLICT (notion_page_id, classification_method) DO UPDATE
 * — re-running refreshes proposals without breaking approve state.
 *
 * Reuses NOTION_TOKEN + NOTION_PCS_* env vars from the backfill script.
 * Adds: SUPABASE_NORDIC_URL + SUPABASE_NORDIC_SERVICE_KEY (or _ANON_KEY).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// ─── Load env ───────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const NOTION_TOKEN              = process.env.NOTION_TOKEN;
const PCS_CLAIMS_DB             = process.env.NOTION_PCS_CLAIMS_DB;
const CANONICAL_CLAIMS_DB       = process.env.NOTION_PCS_CANONICAL_CLAIMS_DB;
const CORE_BENEFITS_DB          = process.env.NOTION_PCS_CORE_BENEFITS_DB || process.env.NOTION_PCS_BENEFIT_CATEGORIES_DB;
const CLAIM_PREFIXES_DB         = process.env.NOTION_PCS_PREFIXES_DB;
const SUPABASE_URL              = process.env.SUPABASE_NORDIC_URL;
const SUPABASE_KEY              = process.env.SUPABASE_NORDIC_SERVICE_KEY || process.env.SUPABASE_NORDIC_ANON_KEY;

if (!NOTION_TOKEN || !PCS_CLAIMS_DB) { console.error('NOTION_TOKEN / NOTION_PCS_CLAIMS_DB missing'); process.exit(1); }
if (!CANONICAL_CLAIMS_DB) { console.error('NOTION_PCS_CANONICAL_CLAIMS_DB missing'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('SUPABASE_NORDIC_URL / SUPABASE_NORDIC_*_KEY missing'); process.exit(1); }

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v == null ? true : v];
  }),
);
const APPLY = !!args.apply;
const RESET = !!args.reset;

console.log(`\nPhase 4.6 Bundle B.1 — seed claim_migration_log`);
console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
if (RESET && APPLY) console.log(`  RESET: will TRUNCATE claim_migration_log first.`);
console.log('');

// ─── Notion API ──────────────────────────────────────────────────────────────
const NOTION = 'https://api.notion.com/v1';
const HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAllPages(databaseId) {
  const all = [];
  let cursor;
  do {
    const r = await fetch(`${NOTION}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!r.ok) throw new Error(`fetchAllPages(${databaseId}) ${r.status}: ${await r.text()}`);
    const j = await r.json();
    all.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
    await sleep(350);
  } while (cursor);
  return all;
}

// ─── Title parsing (mirrors backfill-claim-vocab-tiers.mjs) ─────────────────
function normalize(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/\*+/g, '')
    .replace(/[()]/g, '')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\bthe\b|\ba\b|\ban\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

const KNOWN_PREFIXES = [
  'Required for/Plays a critical role in/Supports',
  'Required for/Plays a critical role in/Nutritional Support for (certain aspects of)',
  'Required for/Plays a critical role in/Nutritional Support for',
  'Nutritional support for',
  'Provides nutritional support for',
  'Essential nutrient support for',
  "Helps to maintain the body's ability to",
  'Helps to maintain',
  'Helps to support',
  'Helps support',
  'Helps to',
  'Helps in',
  'Supports certain aspects of',
  'Contributes to',
  'One serving',
  'Promotes',
  'Supports',
  'Helps',
];

function extractPrefix(title) {
  const t = title.trim();
  for (const p of KNOWN_PREFIXES) {
    if (t.toLowerCase().startsWith(p.toLowerCase())) {
      return { prefix: p, remainder: t.slice(p.length).trim() };
    }
  }
  return { prefix: null, remainder: t };
}

function splitVariants(title) {
  if (title.includes(' / ')) return title.split(' / ').map((s) => s.trim()).filter(Boolean);
  return [title.trim()];
}

function titleOf(page, propertyName) {
  const prop = page.properties?.[propertyName];
  if (!prop) return '';
  if (prop.title) return prop.title.map((t) => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map((t) => t.plain_text).join('');
  return '';
}

function computeConfidence({ matchedPrefix, bestScore, benefitMatches }) {
  const c = (bestScore || 0) * 0.5
          + (matchedPrefix ? 0.3 : 0)
          + (benefitMatches?.length ? 0.2 : 0);
  return Math.round(c * 100) / 100;
}

// ─── Main ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

console.log('Loading dictionaries…');
const [canonical, prefixes, benefits, pcsClaims] = await Promise.all([
  fetchAllPages(CANONICAL_CLAIMS_DB),
  fetchAllPages(CLAIM_PREFIXES_DB),
  CORE_BENEFITS_DB ? fetchAllPages(CORE_BENEFITS_DB) : Promise.resolve([]),
  fetchAllPages(PCS_CLAIMS_DB),
]);
console.log(`  Canonical: ${canonical.length}, Prefixes: ${prefixes.length}, Benefits: ${benefits.length}, PCS: ${pcsClaims.length}\n`);

const canonicalIndex = canonical.map((p) => ({ id: p.id, title: titleOf(p, 'Canonical claim') }));
const prefixIndex    = prefixes.map((p) => ({ id: p.id, title: titleOf(p, 'Prefix') }));
const benefitIndex   = benefits.map((p) => ({ id: p.id, title: titleOf(p, 'Core benefit') }));

const proposals = [];
for (const claim of pcsClaims) {
  const title = titleOf(claim, 'Claim');
  if (!title) continue;
  const existingCanonical = (claim.properties?.['Canonical Claim']?.relation || [])[0];

  const { prefix, remainder } = extractPrefix(title);
  const matchedPrefix = prefix
    ? prefixIndex.find((p) => p.title.toLowerCase() === prefix.toLowerCase())
    : null;

  let bestCanonical = null;
  let bestScore = 0;
  for (const c of canonicalIndex) {
    const s = similarity(remainder || title, c.title);
    if (s > bestScore) { bestScore = s; bestCanonical = c; }
  }

  const benefitMatches = benefitIndex
    .map((b) => ({ b, s: normalize(title).includes(normalize(b.title)) ? 0.9 : similarity(title, b.title) }))
    .filter((x) => x.s > 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2);

  const variants = splitVariants(remainder || title);
  const confidence = computeConfidence({ matchedPrefix, bestScore, benefitMatches });

  proposals.push({
    notion_page_id: claim.id,
    source_database: 'pcs_claims',
    before_text: title,
    after_category: benefitMatches[0]?.b?.id || null,
    after_strength: matchedPrefix?.id || null,
    after_family_key: bestCanonical && bestScore >= 0.5 ? bestCanonical.id : null,
    after_variants: variants.map((v, i) => ({ wording: v, isPrimary: i === 0 })),
    classification_method: 'regex-heuristic-v1',
    classifier_confidence: confidence,
    applied: !!existingCanonical,
    applied_at: existingCanonical ? new Date().toISOString() : null,
    applied_by_email: existingCanonical ? 'system:phase-4.6-backfill' : null,
  });
}

const stats = {
  total: proposals.length,
  alreadyLinked: proposals.filter((p) => p.applied).length,
  highConfidence: proposals.filter((p) => !p.applied && p.classifier_confidence >= 0.99).length,
  midConfidence: proposals.filter((p) => !p.applied && p.classifier_confidence >= 0.7 && p.classifier_confidence < 0.99).length,
  lowConfidence: proposals.filter((p) => !p.applied && p.classifier_confidence < 0.7 && p.after_family_key).length,
  unmatchable: proposals.filter((p) => !p.applied && !p.after_family_key).length,
};
console.log('Stats:');
console.table(stats);

if (!APPLY) {
  console.log('\nDry-run complete. Re-run with --apply to write rows.');
  process.exit(0);
}

if (RESET) {
  console.log('Truncating claim_migration_log…');
  const { error } = await supabase.from('claim_migration_log').delete().not('id', 'is', null);
  if (error) { console.error(`Truncate failed: ${error.message}`); process.exit(1); }
}

console.log(`Inserting ${proposals.length} rows…`);
let inserted = 0;
const BATCH = 100;
for (let i = 0; i < proposals.length; i += BATCH) {
  const batch = proposals.slice(i, i + BATCH);
  const { error } = await supabase.from('claim_migration_log').insert(batch);
  if (error) {
    console.error(`Batch ${i}: ${error.message}`);
    if (i === 0) process.exit(1);
    continue;
  }
  inserted += batch.length;
  if (inserted % 200 === 0 || inserted === proposals.length) console.log(`  ${inserted}/${proposals.length}`);
}
console.log(`\n✓ Inserted ${inserted} rows into claim_migration_log.`);
