#!/usr/bin/env node
/**
 * Import Nordic Naturals' CAIPB (Claims by Active Ingredient, Product, or
 * Benefit) Smartsheet data into Notion.
 *
 * Input:   data/caipb/master.csv (276 rows)
 * Outputs: creates rows in 7 Notion databases in dependency order:
 *   1. Benefit Categories
 *   2. Claim Prefixes  (Evidence type / Qualification level assigned by rubric)
 *   3. Active Ingredients
 *   4. AI Forms
 *   5. Core Benefits
 *   6. Canonical Claims
 *   7. Claim Dose Requirements
 *
 * Usage:
 *   node scripts/import-caipb.mjs [--dry-run] [--archive-existing] [--import] [--limit=N]
 *
 * Flags:
 *   --dry-run           default — print planned creates, write nothing
 *   --archive-existing  archive every row currently in the 5 placeholder DBs
 *                       (Benefit Categories, Claim Prefixes, Active Ingredients,
 *                       AI Forms, Core Benefits) before importing
 *   --import            live create-mode
 *   --limit=N           only process first N CAIPB rows (for smoke tests)
 *
 * Env: loads .env.local then .env.local.migration (same as
 * scripts/reimport-one-pdf.mjs). Requires NOTION_TOKEN + 7 PCS DB IDs.
 *
 * Notes on CSV parsing:
 *   - Row ID is 1-indexed and used for audit trail (Source CAIPB Row ID).
 *   - "Min Dose for Claim" may be the literal string "Not dose specific";
 *     those rows are skipped for Claim Dose Requirements but still create
 *     a Canonical Claim row.
 *   - "Demographic" cells contain embedded newlines (e.g. "Adults: 18+\nM & F").
 *     We CSV-parse them as a quoted field; they are not split here.
 *   - "AI Form" cells may contain multiple space-separated forms. Because
 *     forms themselves contain spaces (e.g. "(TRAACS®) magnesium
 *     bisglycinate"), we do NOT naive-split. We build a form vocabulary
 *     per-AI by doing a greedy longest-match token scan across all rows
 *     (see parseAiFormCell).
 *
 * Manifest:
 *   A successful --import run writes data/caipb/import-log.json with all
 *   created-page mappings keyed by CAIPB Row ID.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// ─── Env loading ─────────────────────────────────────────────────────────
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

// ─── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const doArchive = args.includes('--archive-existing');
const doImport = args.includes('--import');
const dryRun = !doImport && !doArchive ? true : args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

// ─── Imports ─────────────────────────────────────────────────────────────
const { notion } = await import('../src/lib/notion.js');
const { PCS_DB, PROPS } = await import('../src/lib/pcs-config.js');

const NOTION_RATE_MS = 350;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── CSV parsing ─────────────────────────────────────────────────────────
/**
 * Minimal RFC-4180 CSV parser (supports quoted fields with embedded
 * newlines + doubled-quote escaping). Returns an array of row arrays.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      i++; continue;
    }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Column indices (0-indexed) per spec
const COL = {
  rowId: 1,
  fileIdVer: 2,
  finishedGood: 3,
  fmt: 4,
  product: 5,
  demographic: 6,
  benefitCategory: 7,
  claimPrefix: 8,
  claim: 9,
  minDose: 10,
  doseUnit: 11,
  additionalGuidance: 12,
  productDose: 13,
  fmPlm: 14,
  aiSource: 15,
  aiForm: 16,
  ai: 17,
};

// ─── Prefix rubric ───────────────────────────────────────────────────────
/**
 * Assign (Evidence type, Qualification level) based on CAIPB prefix text.
 * Returns { evidenceType, qualificationLevel, ambiguous }.
 *
 * Ambiguous matches are logged to stdout for operator review.
 */
function classifyPrefix(p) {
  const t = (p || '').trim();
  if (t === '' || t === 'NA') {
    return { evidenceType: 'not_applicable', qualificationLevel: 'not_applicable', ambiguous: false };
  }
  const lc = t.toLowerCase();
  const hasRequired = /required for|plays a critical role/i.test(t);
  const hasSupports = /supports/i.test(t);
  const hasMaySupport = /may support/i.test(t);
  const hasNutritionalSupport = /nutritional support for/i.test(t);
  const hasHelps = /^helps\b/i.test(t);
  const hasContributes = /contributes to/i.test(t);
  const hasOneServing = /^one serving/i.test(t);
  const hasEssential = /essential/i.test(t);

  // Compound "required for/supports" — floor at weakest
  if (hasRequired && hasSupports) {
    return { evidenceType: 'clinical_rct', qualificationLevel: 'fully_supported', ambiguous: true };
  }
  if (hasMaySupport) {
    return { evidenceType: 'qualified', qualificationLevel: 'deprecated', ambiguous: false };
  }
  if (hasNutritionalSupport) {
    return { evidenceType: 'qualified', qualificationLevel: 'dose_qualified', ambiguous: false };
  }
  if (hasHelps || hasContributes || hasOneServing) {
    return { evidenceType: 'qualified', qualificationLevel: 'dose_qualified', ambiguous: false };
  }
  if (hasRequired || hasEssential) {
    return { evidenceType: 'essential_nutrient', qualificationLevel: 'fully_supported', ambiguous: false };
  }
  if (hasSupports) {
    return { evidenceType: 'clinical_rct', qualificationLevel: 'fully_supported', ambiguous: false };
  }
  // Safe default
  return { evidenceType: 'qualified', qualificationLevel: 'dose_qualified', ambiguous: true };
}

// ─── AI Form cell splitter ───────────────────────────────────────────────
/**
 * Split a single "AI Form" cell into one-or-more form strings.
 *
 * CAIPB stores multiple forms per cell separated by NEWLINES, e.g.:
 *   "(TRAACS®) magnesium bisglycinate\n(TRAACS®) magnesium lysinate bisglycinate\nmagnesium malate"
 * Split on newline, trim each, drop empties.
 *
 * Demographic cells use the same newline-separation convention.
 */
function buildFormVocabularyByAI(rows) {
  const vocab = new Map(); // aiName -> Set<form>
  for (const r of rows) {
    const ai = (r[COL.ai] || '').trim();
    const cell = (r[COL.aiForm] || '').trim();
    if (!ai || !cell) continue;
    if (!vocab.has(ai)) vocab.set(ai, new Set());
    for (const f of cell.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      vocab.get(ai).add(f);
    }
  }
  // Convert sets to sorted arrays for deterministic logging
  const out = new Map();
  for (const [ai, set] of vocab.entries()) {
    out.set(ai, Array.from(set).sort());
  }
  return out;
}

function splitAiFormCell(cell) {
  return (cell || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Ingredient categorization heuristic ────────────────────────────────
function inferAiCategory(name) {
  const n = (name || '').toLowerCase();
  if (/vitamin|cobalamin|folate|folic|niacin|riboflavin|thiamin|biotin|ascorbic|retinol|calciferol/.test(n)) return 'Vitamin';
  if (/magnesium|calcium|zinc|iron|selenium|chromium|copper|manganese|iodine|potassium|sodium|phosphorus/.test(n)) return 'Mineral';
  if (/epa|dha|omega-3|omega 3|fish oil/.test(n)) return 'Omega-3';
  if (/probiotic|lactobacillus|bifidobacterium/.test(n)) return 'Probiotic';
  return 'Other';
}

// ─── Logging ─────────────────────────────────────────────────────────────
const errorLog = [];
function log(prefix, msg) { console.log(`[${prefix}] ${msg}`); }

// ─── Archive existing rows ──────────────────────────────────────────────
async function archiveDb(label, dbId) {
  if (!dbId) { log('skip', `${label}: no DB id configured`); return 0; }
  let total = 0;
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of res.results) {
      if (page.archived) continue;
      if (dryRun) {
        log('dry', `would archive ${label} page ${page.id}`);
      } else {
        try {
          await notion.pages.update({ page_id: page.id, archived: true });
          log('ok', `archived ${label} ${page.id}`);
          await sleep(NOTION_RATE_MS);
        } catch (err) {
          errorLog.push({ phase: 'archive', db: label, id: page.id, error: err.message });
          log('fail', `archive ${label} ${page.id}: ${err.message}`);
        }
      }
      total++;
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return total;
}

async function archiveAllPlaceholderDbs() {
  log('ok', 'Phase 0: archiving existing placeholder rows…');
  const dbs = [
    ['Active Ingredients', PCS_DB.ingredients],
    ['AI Forms', PCS_DB.ingredientForms],
    ['Claim Prefixes', PCS_DB.prefixes],
    ['Benefit Categories', PCS_DB.benefitCategories],
    ['Core Benefits', PCS_DB.coreBenefits],
  ];
  for (const [label, id] of dbs) {
    const n = await archiveDb(label, id);
    log('ok', `${label}: ${n} row(s) ${dryRun ? 'planned' : 'archived'}`);
  }
}

// ─── Create helpers ─────────────────────────────────────────────────────
async function createOrDry(label, parentDbId, properties, preview) {
  if (dryRun) {
    log('dry', `CREATE ${label}: ${preview}`);
    return { id: `dry-${label}-${Math.random().toString(36).slice(2, 10)}`, dry: true };
  }
  try {
    const page = await notion.pages.create({
      parent: { database_id: parentDbId },
      properties,
    });
    log('ok', `CREATE ${label}: ${preview} → ${page.id}`);
    await sleep(NOTION_RATE_MS);
    return page;
  } catch (err) {
    errorLog.push({ phase: label, preview, error: err.message });
    log('fail', `CREATE ${label}: ${preview}: ${err.message}`);
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  log('ok', `CAIPB import — dryRun=${dryRun} archive=${doArchive} import=${doImport} limit=${LIMIT ?? 'all'}`);

  const csvPath = resolve(projectRoot, 'data/caipb/master.csv');
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }
  const csvBytes = readFileSync(csvPath);
  const csvText = csvBytes.toString('utf8');
  const csvSha = createHash('sha256').update(csvBytes).digest('hex');
  const allRows = parseCsv(csvText);
  // allRows[0] = header; [1..] = data
  const header = allRows[0];
  // Filter: require Row ID AND a Claim (empty Claim = trailing placeholder row).
  const dataRows = allRows.slice(1).filter(r =>
    r.length > 1 && (r[COL.rowId] || '').trim() && (r[COL.claim] || '').trim()
  );
  log('ok', `parsed ${dataRows.length} data rows (header has ${header.length} cols)`);
  const rows = LIMIT ? dataRows.slice(0, LIMIT) : dataRows;

  if (doArchive) {
    await archiveAllPlaceholderDbs();
  }

  if (!doImport && !dryRun) {
    log('ok', 'no --import flag; skipping create phases.');
    return;
  }
  if (!doImport && dryRun) {
    log('ok', 'dry-run mode — will plan creates but not write.');
  }

  // ─── Phase 1: Benefit Categories ───────────────────────────────────────
  log('ok', 'Phase 1: Benefit Categories');
  const benefitCatIds = new Map(); // text -> pageId
  const uniqBenefitCats = new Set();
  for (const r of rows) {
    const v = (r[COL.benefitCategory] || '').trim();
    if (v) uniqBenefitCats.add(v);
  }
  for (const name of uniqBenefitCats) {
    const P = PROPS.benefitCategories;
    const props = {
      [P.name]: { title: [{ text: { content: name } }] },
    };
    const page = await createOrDry('BenefitCategory', PCS_DB.benefitCategories, props, name);
    if (page) benefitCatIds.set(name, page.id);
  }

  // ─── Phase 2: Claim Prefixes ──────────────────────────────────────────
  log('ok', 'Phase 2: Claim Prefixes');
  const prefixIds = new Map(); // text -> pageId
  const uniqPrefixes = new Set();
  for (const r of rows) {
    const v = (r[COL.claimPrefix] || '').trim();
    if (v) uniqPrefixes.add(v);
  }
  for (const text of uniqPrefixes) {
    const { evidenceType, qualificationLevel, ambiguous } = classifyPrefix(text);
    if (ambiguous) {
      log('ok', `[rubric-ambiguous] "${text}" → evidence=${evidenceType} qualification=${qualificationLevel}`);
    }
    const P = PROPS.prefixes;
    const props = {
      // Title property per PROPS.prefixes.prefix = 'Prefix'
      [P.prefix]: { title: [{ text: { content: text } }] },
      // Evidence type / Qualification level — added to the DB by parent
      // process via Notion MCP before this script runs. Using string
      // literals since PROPS.prefixes does not yet include them.
      'Evidence type': { select: { name: evidenceType } },
      'Qualification level': { select: { name: qualificationLevel } },
    };
    const preview = `"${text}" [${evidenceType}/${qualificationLevel}]`;
    const page = await createOrDry('ClaimPrefix', PCS_DB.prefixes, props, preview);
    if (page) prefixIds.set(text, page.id);
  }

  // ─── Phase 3: Active Ingredients ───────────────────────────────────────
  log('ok', 'Phase 3: Active Ingredients');
  const ingredientIds = new Map(); // ai text (verbatim, kept CAIPB casing) -> pageId
  const uniqAIs = new Set();
  for (const r of rows) {
    const v = (r[COL.ai] || '').trim();
    if (v) uniqAIs.add(v);
  }
  for (const ai of uniqAIs) {
    const P = PROPS.ingredients;
    const category = inferAiCategory(ai);
    const props = {
      [P.canonicalName]: { title: [{ text: { content: ai } }] },
      [P.category]: { select: { name: category } },
      [P.standardUnit]: { select: { name: 'mg' } },
      [P.synonyms]: { rich_text: [{ text: { content: '' } }] },
    };
    const page = await createOrDry('ActiveIngredient', PCS_DB.ingredients, props, `${ai} [${category}/mg]`);
    if (page) ingredientIds.set(ai, page.id);
  }

  // ─── Phase 4: AI Forms ─────────────────────────────────────────────────
  log('ok', 'Phase 4: AI Forms');
  const formIds = new Map(); // `${ai}::${formName}` -> pageId
  const vocab = buildFormVocabularyByAI(rows);
  // Dump vocab for operator visibility
  for (const [ai, atoms] of vocab.entries()) {
    log('ok', `[vocab] ${ai}: ${atoms.length} form(s) — ${atoms.map(a => JSON.stringify(a)).join(', ')}`);
  }
  const uniqForms = new Map(); // `${ai}::${form}` -> { ai, form }
  for (const r of rows) {
    const ai = (r[COL.ai] || '').trim();
    const cell = (r[COL.aiForm] || '').trim();
    if (!ai || !cell) continue;
    const parts = splitAiFormCell(cell);
    for (const f of parts) {
      const key = `${ai}::${f}`;
      if (!uniqForms.has(key)) uniqForms.set(key, { ai, form: f });
    }
  }
  for (const [key, { ai, form }] of uniqForms.entries()) {
    const aiPageId = ingredientIds.get(ai);
    if (!aiPageId) {
      log('fail', `AI Form orphan — no AI page for "${ai}" (form="${form}")`);
      errorLog.push({ phase: 'form', ai, form, error: 'no AI page id' });
      continue;
    }
    const P = PROPS.ingredientForms;
    const props = {
      [P.formName]: { title: [{ text: { content: form } }] },
    };
    // Only attach relation when we actually have a real page id.
    if (!String(aiPageId).startsWith('dry-')) {
      props[P.activeIngredient] = { relation: [{ id: aiPageId }] };
    }
    const page = await createOrDry('AIForm', PCS_DB.ingredientForms, props, `"${form}" → ${ai}`);
    if (page) formIds.set(key, page.id);
  }

  // ─── Phase 5: Core Benefits ────────────────────────────────────────────
  log('ok', 'Phase 5: Core Benefits');
  const coreBenefitIds = new Map(); // stripped-claim-text -> pageId
  // Build unique (strippedClaim, benefitCategory) pairs — choose first BC seen
  const coreBenefitMeta = new Map(); // stripped -> { bcName }
  for (const r of rows) {
    const raw = (r[COL.claim] || '').trim();
    if (!raw) continue;
    const stripped = raw.replace(/\*+$/, '').trim();
    const bc = (r[COL.benefitCategory] || '').trim();
    if (!coreBenefitMeta.has(stripped)) coreBenefitMeta.set(stripped, { bcName: bc });
  }
  for (const [stripped, { bcName }] of coreBenefitMeta.entries()) {
    const P = PROPS.coreBenefits;
    const props = {
      [P.coreBenefit]: { title: [{ text: { content: stripped } }] },
    };
    const bcPageId = benefitCatIds.get(bcName);
    if (bcPageId && !String(bcPageId).startsWith('dry-')) {
      props[P.benefitCategory] = { relation: [{ id: bcPageId }] };
    }
    const page = await createOrDry('CoreBenefit', PCS_DB.coreBenefits, props, `"${stripped}" → ${bcName}`);
    if (page) coreBenefitIds.set(stripped, page.id);
  }

  // ─── Phase 6: Canonical Claims ─────────────────────────────────────────
  log('ok', 'Phase 6: Canonical Claims');
  // Task-specified property names on Canonical Claims DB. PROPS.canonicalClaims
  // currently only declares `claimPrefix` and `coreBenefit` relations; the
  // other relation properties ("Active ingredient", "Benefit category") and
  // the "Source CAIPB Row ID" number property are assumed to have been added
  // to the DB by the parent process before this import.
  const CANONICAL_PROP = {
    title: PROPS.canonicalClaims.canonicalClaim,   // 'Canonical claim'
    prefix: PROPS.canonicalClaims.claimPrefix,     // 'Claim prefix'
    coreBenefit: PROPS.canonicalClaims.coreBenefit, // 'Core benefit'
    activeIngredient: 'Active ingredient',
    benefitCategory: 'Benefit category',
    sourceRowId: 'Source CAIPB Row ID',
  };
  const caipbRowToCanonical = {}; // rowId (string) -> pageId
  for (const r of rows) {
    const rowId = (r[COL.rowId] || '').trim();
    const claimText = (r[COL.claim] || '').trim();
    if (!rowId || !claimText) continue;
    const stripped = claimText.replace(/\*+$/, '').trim();
    const prefixText = (r[COL.claimPrefix] || '').trim();
    const bcName = (r[COL.benefitCategory] || '').trim();
    const aiName = (r[COL.ai] || '').trim();

    const props = {
      [CANONICAL_PROP.title]: { title: [{ text: { content: claimText } }] },
    };
    const pId = prefixIds.get(prefixText);
    if (pId && !String(pId).startsWith('dry-')) {
      props[CANONICAL_PROP.prefix] = { relation: [{ id: pId }] };
    }
    const cbId = coreBenefitIds.get(stripped);
    if (cbId && !String(cbId).startsWith('dry-')) {
      props[CANONICAL_PROP.coreBenefit] = { relation: [{ id: cbId }] };
    }
    const aiId = ingredientIds.get(aiName);
    if (aiId && !String(aiId).startsWith('dry-')) {
      props[CANONICAL_PROP.activeIngredient] = { relation: [{ id: aiId }] };
    }
    const bcId = benefitCatIds.get(bcName);
    if (bcId && !String(bcId).startsWith('dry-')) {
      props[CANONICAL_PROP.benefitCategory] = { relation: [{ id: bcId }] };
    }
    const rowIdNum = Number.parseInt(rowId, 10);
    if (Number.isFinite(rowIdNum)) {
      props[CANONICAL_PROP.sourceRowId] = { number: rowIdNum };
    }

    const page = await createOrDry('CanonicalClaim', PCS_DB.canonicalClaims, props, `row ${rowId}: "${claimText.slice(0, 60)}"`);
    if (page) caipbRowToCanonical[rowId] = page.id;
  }

  // ─── Phase 7: Claim Dose Requirements ─────────────────────────────────
  log('ok', 'Phase 7: Claim Dose Requirements');
  const caipbRowToDoseReq = {};
  for (const r of rows) {
    const rowId = (r[COL.rowId] || '').trim();
    const minDoseRaw = (r[COL.minDose] || '').trim();
    const unit = (r[COL.doseUnit] || '').trim();
    const aiName = (r[COL.ai] || '').trim();
    if (!rowId || !minDoseRaw) continue;
    if (/^not dose specific$/i.test(minDoseRaw)) {
      log('skip', `row ${rowId}: "Not dose specific" → no dose req`);
      continue;
    }
    const doseNum = Number.parseFloat(minDoseRaw.replace(/,/g, ''));
    if (!Number.isFinite(doseNum)) {
      log('skip', `row ${rowId}: min dose "${minDoseRaw}" non-numeric`);
      continue;
    }
    const unitForName = unit && unit !== 'NA' ? unit : '';
    const name = `${aiName} ${doseNum}${unitForName ? ' ' + unitForName : ''}`.trim();
    const P = PROPS.claimDoseReqs;
    const props = {
      [P.requirement]: { title: [{ text: { content: name } }] },
      [P.amount]: { number: doseNum },
      [P.combinationGroup]: { number: 1 },
    };
    if (unit && unit !== 'NA') {
      props[P.unit] = { select: { name: unit } };
    }
    // Keep the rich-text AI field populated for backward compat
    if (aiName) {
      props[P.activeIngredient] = { rich_text: [{ text: { content: aiName } }] };
    }
    const aiId = ingredientIds.get(aiName);
    if (aiId && !String(aiId).startsWith('dry-')) {
      // W2 canonical relation (single)
      props[P.activeIngredientCanonical] = { relation: [{ id: aiId }] };
    }
    const page = await createOrDry('ClaimDoseReq', PCS_DB.claimDoseReqs, props, `row ${rowId}: ${name}`);
    if (page) caipbRowToDoseReq[rowId] = page.id;
  }

  // ─── Manifest ─────────────────────────────────────────────────────────
  const manifest = {
    timestamp: new Date().toISOString(),
    source_csv_sha256: csvSha,
    counts: {
      benefitCategories: benefitCatIds.size,
      prefixes: prefixIds.size,
      activeIngredients: ingredientIds.size,
      forms: formIds.size,
      coreBenefits: coreBenefitIds.size,
      canonicalClaims: Object.keys(caipbRowToCanonical).length,
      claimDoseReqs: Object.keys(caipbRowToDoseReq).length,
    },
    mappings: {
      caipbRowId_to_canonicalClaimPageId: caipbRowToCanonical,
      caipbRowId_to_claimDoseReqPageId: caipbRowToDoseReq,
    },
    errors: errorLog,
  };

  log('ok', `Summary: ${JSON.stringify(manifest.counts)}`);
  if (errorLog.length > 0) {
    log('fail', `${errorLog.length} error(s) logged — see errors[] in manifest`);
  }

  if (doImport && !dryRun) {
    const outPath = resolve(projectRoot, 'data/caipb/import-log.json');
    writeFileSync(outPath, JSON.stringify(manifest, null, 2));
    log('ok', `wrote manifest → ${outPath}`);
  } else {
    log('ok', 'dry-run: manifest not written');
    // Emit a compact preview to stdout
    console.log(JSON.stringify(manifest.counts, null, 2));
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
