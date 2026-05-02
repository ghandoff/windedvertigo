#!/usr/bin/env node
/**
 * Wave 4.6 — repair Request rows created before the Wave 4.3.2 fix to
 * `createRequest()` persisted `requestType` + `specificField`.
 *
 * Those rows were written by scripts/backfill-research-requests.mjs (template-drift
 * nightly sweep) and the Wave 4.3.1 BackfillSideSheet UI. They exist in Notion
 * but have empty type/field columns, so every type-filtered query or digest
 * misses them.
 *
 *   node scripts/repair-pre-4.3.2-request-rows.mjs --dry-run
 *   node scripts/repair-pre-4.3.2-request-rows.mjs --limit=10
 *   node scripts/repair-pre-4.3.2-request-rows.mjs
 *
 * Heuristic (title → type + specificField):
 *   "Template drift: <version> — PCS-####"     → type=template-drift,  field=template-version
 *   "Low-confidence extraction: <field> on …"  → type=low-confidence,  field=<parsed>
 *   "Backfill: Table N <field> for PCS-…"      → type=missing-field,   field=Table N <field>
 *   unknown pattern                            → skipped with warning (no fallback — safer to leave untouched)
 *
 * Scope filter: rows where `requestType` is null AND `source = 'nightly-sweep'`.
 * (The Wave 4.3.1 BackfillSideSheet used source='manual' historically, so if any
 * 'Backfill: Table …' rows exist with source='manual' they will NOT be picked up
 * here — reported as open question in the wave summary.)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env ───────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const envCandidates = ['.env.local', '.env.local.migration'];
let envLoaded = 0;
for (const candidate of envCandidates) {
  const envFile = resolve(projectRoot, candidate);
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    let val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    val = val.replace(/\\n$/, '').trim();
    if (!process.env[key]) {
      process.env[key] = val;
      envLoaded++;
    }
  }
}
if (envLoaded === 0) {
  console.error('No env files found. Tried:', envCandidates.join(', '));
  process.exit(1);
}
if (!process.env.NOTION_TOKEN || !process.env.NOTION_PCS_REQUESTS_DB) {
  console.error('Missing required env: NOTION_TOKEN and/or NOTION_PCS_REQUESTS_DB');
  process.exit(1);
}

// ─── Parse args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

// ─── Classifier ─────────────────────────────────────────────────────────────
/**
 * Given a Request title (and optional notes), return `{ requestType, specificField }`
 * or null when the title doesn't match a known pattern (caller should skip).
 */
function classifyByTitle(title /*, notes */) {
  const t = (title || '').trim();
  if (!t) return null;

  // 1. Template drift — "Template drift: <version> — PCS-####"
  //    Matches the shape emitted by Wave 4.5.0 generator + backfill script.
  if (/^Template drift:/i.test(t)) {
    return { requestType: 'template-drift', specificField: 'template-version' };
  }

  // 2. Low-confidence extraction — "Low-confidence extraction: <field> on PCS-####"
  {
    const m = t.match(/^Low-confidence extraction:\s*(.+?)\s+on\s+/i);
    if (m) {
      return { requestType: 'low-confidence', specificField: m[1].trim() };
    }
  }

  // 3. Backfill missing-field — "Backfill: Table N <field> for PCS-####"
  //    Emitted by Wave 4.3.1 BackfillSideSheet. Strip the "for PCS-…" suffix.
  {
    const m = t.match(/^Backfill:\s*(.+?)\s+for\s+PCS-/i);
    if (m) {
      return { requestType: 'missing-field', specificField: m[1].trim() };
    }
  }

  return null;
}

// ─── Load libs ──────────────────────────────────────────────────────────────
const { getAllRequests, updateRequest } = await import('../src/lib/pcs-requests.js');

console.log('\n=== Pre-4.3.2 Request row repair (Wave 4.6) ===');
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT}`);
console.log('');

const all = await getAllRequests();
console.log(`Fetched ${all.length} Requests`);

// Scope: null requestType AND source=nightly-sweep (matches the 5 auto-backfilled rows).
const scope = all.filter(r => !r.requestType && r.source === 'nightly-sweep');
console.log(`  → ${scope.length} nightly-sweep rows with null requestType`);

const target = LIMIT ? scope.slice(0, LIMIT) : scope;

const agg = { repaired: 0, skippedUnknown: 0, errors: 0 };
const skipped = [];
const errors = [];

for (const row of target) {
  const cls = classifyByTitle(row.request, row.requestNotes);
  if (!cls) {
    agg.skippedUnknown += 1;
    skipped.push({ id: row.id, title: row.request });
    console.log(`[skip] "${row.request}" — no pattern match (leaving untouched)`);
    continue;
  }

  const label = `[${dryRun ? 'dry' : 'repair'}] "${row.request}" → type=${cls.requestType}, field=${cls.specificField}`;
  if (dryRun) {
    console.log(label);
    agg.repaired += 1;
    continue;
  }

  try {
    await updateRequest(row.id, {
      requestType: cls.requestType,
      specificField: cls.specificField,
    });
    agg.repaired += 1;
    console.log(`${label} ✓`);
  } catch (err) {
    agg.errors += 1;
    errors.push({ id: row.id, title: row.request, error: err?.message || String(err) });
    console.error(`[fail] ${row.id} "${row.request}": ${err?.message || err}`);
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({ dryRun, scope: scope.length, processed: target.length, agg }, null, 2));
if (skipped.length > 0) {
  console.log('\n=== Skipped (unknown title pattern) ===');
  for (const s of skipped) console.log(`  ${s.id}: ${s.title}`);
}
if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) console.log(`  ${e.id}: ${e.error}`);
  process.exit(1);
}
