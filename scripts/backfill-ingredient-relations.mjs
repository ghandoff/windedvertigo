#!/usr/bin/env node
/**
 * Backfill canonical ingredient relations on existing rows.
 *
 * Targets:
 *   - Formula Lines: Active Ingredient (canonical) + Active Ingredient Form (canonical)
 *   - Evidence Library: Active Ingredient (canonical) [multi]
 *   - Claim Dose Requirements: Active Ingredient (canonical)
 *
 * Pure fuzzy matching (canonical name + comma-separated synonyms) — no
 * LLM calls, free.
 *
 * Usage:
 *   node scripts/backfill-ingredient-relations.mjs                       # all tables, write
 *   node scripts/backfill-ingredient-relations.mjs --dry-run             # preview, no writes
 *   node scripts/backfill-ingredient-relations.mjs --table=formula       # single table
 *   node scripts/backfill-ingredient-relations.mjs --limit=10 --dry-run  # try first 10 in each
 *
 * Env: loads .env.local (preferred) or .env.local.migration. Requires
 *   NOTION_TOKEN, NOTION_PCS_INGREDIENTS_DB, NOTION_PCS_INGREDIENT_FORMS_DB,
 *   NOTION_PCS_FORMULA_LINES_DB, NOTION_PCS_EVIDENCE_DB,
 *   NOTION_PCS_CLAIM_DOSE_REQS_DB.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env ─────────────────────────────────────────────────────────────
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

// ─── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;
const tableArg = args.find(a => a.startsWith('--table='));
const tableSel = tableArg ? tableArg.slice('--table='.length) : null;

const TABLE_ALIASES = {
  formula: 'formula',
  'formula-lines': 'formula',
  evidence: 'evidence',
  'evidence-library': 'evidence',
  claims: 'claims',
  'claim-dose-reqs': 'claims',
};
let tables = ['formula', 'evidence', 'claims'];
if (tableSel) {
  const t = TABLE_ALIASES[tableSel.toLowerCase()];
  if (!t) {
    console.error(`Unknown --table value: ${tableSel}. Use formula | evidence | claims.`);
    process.exit(1);
  }
  tables = [t];
}

// ─── Run ─────────────────────────────────────────────────────────────────
const { runIngredientRelationsBackfill } = await import('../src/lib/ingredient-backfill.js');

console.log('─── Ingredient relations backfill ───');
console.log(`  dryRun: ${dryRun}`);
console.log(`  limit:  ${limit ?? 'none'}`);
console.log(`  tables: ${tables.join(', ')}`);
console.log('');

const t0 = Date.now();
const result = await runIngredientRelationsBackfill({ tables, dryRun, limit });
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`Canonical sources: ${result.canonical.ingredients} ingredients, ${result.canonical.forms} forms`);
console.log('');

function summarize(name, r) {
  if (!r) return;
  console.log(`── ${name} ─────────────────────────────`);
  console.log(`  scanned:       ${r.totalScanned}`);
  console.log(`  alreadyTagged: ${r.alreadyTagged}`);
  console.log(`  processed:     ${r.processed}`);
  console.log(`  matched:       ${r.matched.length}`);
  console.log(`  noMatch:       ${r.noMatch.length}`);
  console.log(`  errors:        ${r.errors.length}`);
  if (r.matched.length > 0) {
    console.log('  sample matches:');
    for (const m of r.matched.slice(0, 5)) {
      console.log(`    • ${JSON.stringify(m)}`);
    }
  }
  if (r.noMatch.length > 0) {
    console.log('  sample no-match:');
    for (const m of r.noMatch.slice(0, 5)) {
      console.log(`    • ${JSON.stringify(m)}`);
    }
  }
  if (r.errors.length > 0) {
    console.log('  errors:');
    for (const e of r.errors.slice(0, 5)) {
      console.log(`    ! ${JSON.stringify(e)}`);
    }
  }
  console.log('');
}

summarize('Formula Lines', result.formula);
summarize('Evidence Library', result.evidence);
summarize('Claim Dose Requirements', result.claims);

console.log(`Done in ${elapsed}s${dryRun ? ' (dry run — no writes)' : ''}.`);
