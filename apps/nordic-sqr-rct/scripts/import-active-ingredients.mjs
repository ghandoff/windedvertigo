#!/usr/bin/env node
/**
 * Bundle 4 P3 — Active Ingredient master import.
 *
 * Populates the Postgres `cv_active_ingredients` and `cv_ai_forms` tables
 * (seeded by db/migrations/003_aics_entity_ddl.sql) from Lauren Bosio's
 * "AI Details for Qualified Raw Materials" Smartsheet (link sent in the
 * 2026-04-16 meeting Notion notes — see notion://344e4ee74ba480808e68f5fbf16d1ca5).
 *
 * Feeds:
 *   - the Bundle 4 P1/P2 form-driven claim-entry dropdowns (currently
 *     empty because cv_active_ingredients has 0 rows)
 *   - the AICS Documents `AI Name` lookup
 *
 * Scope (today):
 *   - SCAFFOLD ONLY. Reads from a local CSV export of the Smartsheet,
 *     not from the Smartsheet API directly. The Smartsheet API needs
 *     a token + the sheet ID, which Lauren has not yet shared. When
 *     credentials land, swap the file-read for an API fetch.
 *   - --dry-run by default; --apply must be passed explicitly to write.
 *   - Idempotent: ON CONFLICT DO NOTHING on cv_active_ingredients.ai_name.
 *
 * Run:
 *   node scripts/import-active-ingredients.mjs --dry-run --csv=./tmp/ais.csv
 *   node scripts/import-active-ingredients.mjs --csv=./tmp/ais.csv --apply
 *
 * CSV columns expected (case-insensitive, order-insensitive):
 *   ai_name              required (e.g. "vitamin D3")
 *   ai_class             optional (e.g. "fat-soluble vitamin")
 *   ai_form_name         optional — repeated rows with the same ai_name
 *                        produce multiple cv_ai_forms entries
 *   ai_form_display_name optional — falls back to ai_form_name
 *
 * Future (Phase 4.4):
 *   - Direct Smartsheet API fetch via SMARTSHEET_API_TOKEN
 *   - Backfill of `cv_ai_sources` from the same Smartsheet's source column
 *   - Notion-side mirror DB so the AICS Documents `AI Name` field can
 *     become a relation rather than free-text
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env ───────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

// ─── Args ───────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v == null ? true : v];
  }),
);
const APPLY = !!args.apply;
const DRY_RUN = !APPLY;
const CSV_PATH = args.csv;

if (!CSV_PATH) {
  console.error('Usage: node scripts/import-active-ingredients.mjs --csv=<path> [--apply]');
  console.error('       Without --apply, runs in dry-run mode (default).');
  process.exit(1);
}
if (!existsSync(CSV_PATH)) {
  console.error(`CSV not found: ${CSV_PATH}`);
  process.exit(1);
}

// ─── Parse CSV ──────────────────────────────────────────────────────────────
const raw = readFileSync(CSV_PATH, 'utf8');
const lines = raw.split('\n').filter((l) => l.trim());
if (lines.length < 2) {
  console.error('CSV has no data rows.');
  process.exit(1);
}

const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
const idxAiName = headers.indexOf('ai_name');
const idxAiClass = headers.indexOf('ai_class');
const idxAiFormName = headers.indexOf('ai_form_name');
const idxAiFormDisplay = headers.indexOf('ai_form_display_name');

if (idxAiName === -1) {
  console.error('CSV missing required column: ai_name');
  console.error(`  found: ${headers.join(', ')}`);
  process.exit(1);
}

// Naive CSV parser (no quoted-field handling — Lauren's Smartsheet exports
// are clean enough). If commas appear inside fields, swap to a quoted-CSV
// parser (papaparse, csv-parse) before going live.
const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
const aiByName = new Map();
for (const row of rows) {
  const name = row[idxAiName];
  if (!name) continue;
  if (!aiByName.has(name)) {
    aiByName.set(name, {
      ai_name: name,
      display_name: name,
      ai_class: idxAiClass >= 0 ? row[idxAiClass] || null : null,
      forms: [],
    });
  }
  if (idxAiFormName >= 0 && row[idxAiFormName]) {
    aiByName.get(name).forms.push({
      form_name: row[idxAiFormName],
      display_name: idxAiFormDisplay >= 0 ? row[idxAiFormDisplay] || row[idxAiFormName] : row[idxAiFormName],
    });
  }
}

const aiList = Array.from(aiByName.values());
console.log(`\nParsed ${aiList.length} active ingredients from ${CSV_PATH}.`);
console.log(`  Total AI forms: ${aiList.reduce((sum, a) => sum + a.forms.length, 0)}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (use --apply to write)' : 'APPLY'}\n`);

if (DRY_RUN) {
  console.log('Sample of parsed AIs (first 5):');
  for (const ai of aiList.slice(0, 5)) {
    console.log(`  - ${ai.ai_name}${ai.ai_class ? ` [${ai.ai_class}]` : ''}`);
    for (const f of ai.forms) console.log(`      form: ${f.form_name}`);
  }
  if (aiList.length > 5) console.log(`  ... +${aiList.length - 5} more`);
  console.log('\nNo writes performed. Re-run with --apply when ready.');
  process.exit(0);
}

// ─── Apply ──────────────────────────────────────────────────────────────────
// We don't have a Postgres helper in the codebase yet (the platform is
// Notion-primary). When the Phase N3 dual-write helpers land, swap the
// stub below for the real DB writer. For now, emit SQL to stdout that
// the operator can paste into `supabase db query --linked`.

const sqlStatements = [];
for (const ai of aiList) {
  const aiName = ai.ai_name.replace(/'/g, "''");
  const displayName = ai.display_name.replace(/'/g, "''");
  const aiClass = ai.ai_class ? `'${ai.ai_class.replace(/'/g, "''")}'` : 'NULL';
  sqlStatements.push(
    `INSERT INTO cv_active_ingredients (ai_name, display_name, ai_class) VALUES ('${aiName}', '${displayName}', ${aiClass}) ON CONFLICT (ai_name) DO NOTHING;`,
  );
  for (const f of ai.forms) {
    const formName = f.form_name.replace(/'/g, "''");
    const formDisplay = f.display_name.replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO cv_ai_forms (active_ingredient_id, form_name, display_name) SELECT id, '${formName}', '${formDisplay}' FROM cv_active_ingredients WHERE ai_name='${aiName}' ON CONFLICT (active_ingredient_id, form_name) DO NOTHING;`,
    );
  }
}

console.log('Generated SQL (paste into `supabase db query --linked`):\n');
console.log('-- BEGIN AI master import --');
for (const stmt of sqlStatements) console.log(stmt);
console.log('-- END AI master import --');
console.log(`\n${sqlStatements.length} statements. Operator must apply via supabase db query --linked.`);
console.log('Phase 4.4 swaps this script for a direct DB write once a Postgres helper lands in src/lib/.');
