#!/usr/bin/env node
// scripts/backfill-aics-to-supabase.mjs
// ─────────────────────────────────────────────────────────────────────
// One-time backfill of all AICS Notion data into Supabase Postgres.
//
// Pulls from Notion directly (paginating each AICS database), parses
// rows using the same logic as src/lib/aics-documents.js, and upserts
// into the public.aics_* tables defined in
// supabase/migrations/20260503104000_003_aics_entity_ddl.sql.
//
// Idempotent: re-running refreshes existing rows by `notion_page_id`.
//
// Run (after ensuring .env.local has the required AICS env vars):
//   cd apps/nordic-sqr-rct
//   node --env-file=.env.local scripts/backfill-aics-to-supabase.mjs
//
// Flags:
//   --table=<aics_documents|aics_versions|aics_claims>
//       Only backfill one table. If absent, runs all three in order
//       (documents → versions → claims, parent before child).
//
// ─────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
// Use the app's wrapped notion client — it handles the v5 API migration
// (database_id → data_source_id resolution) transparently.
import { notion } from '../src/lib/notion.js';

// ─── CLI parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt  = (name) => {
  const m = args.find((a) => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : null;
};
const ONLY_TABLE = opt('--table');

const PAGE_SIZE  = 100;
const BATCH_SIZE = 100;

// ─── Notion DB IDs ──────────────────────────────────────────────────
const AICS_DOCUMENTS_DB = process.env.NOTION_AICS_DOCUMENTS_DB;
const AICS_VERSIONS_DB  = process.env.NOTION_AICS_VERSIONS_DB;
const AICS_CLAIMS_DB    = process.env.NOTION_AICS_CLAIMS_DB;

// ─── Column-name overrides (camelCase → Postgres column) ────────────
// Most camelCase fields follow mechanical camelCase → snake_case.
// Only fields that deviate from that rule are listed here.
const AICS_DOCUMENTS_PG_COLUMN_MAP = {};

const AICS_VERSIONS_PG_COLUMN_MAP = {};

const AICS_CLAIMS_PG_COLUMN_MAP = {
  // regex produces fda_d_s_h_e_a_... — schema wants fda_dshea_...
  fdaDsheaDisclaimerRequired: 'fda_dshea_disclaimer_required',
  // claimPrefix text field → claim_prefix_text column
  claimPrefix: 'claim_prefix_text',
};

// ─── Helpers ────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/**
 * Convert a parsed Notion-shape row (camelCase keys, `id` for notion_page_id)
 * to a Postgres row object, applying the column-name override map.
 * Mirrors the notionShapeToPgRow function in src/lib/supabase-pcs.js exactly.
 */
function notionShapeToPgRow(parsed, columnMap = {}) {
  const out = {};
  for (const [k, v] of Object.entries(parsed || {})) {
    if (k.startsWith('_')) continue;
    if (v === undefined) continue;
    if (k === 'id') {
      out.notion_page_id = v;
      continue;
    }
    if (k === 'createdTime') {
      out.notion_created_at = v;
      continue;
    }
    if (k === 'lastEditedTime') {
      out.notion_last_edited_at = v;
      continue;
    }
    const pgKey =
      columnMap[k] ?? k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    out[pgKey] = v;
  }
  return out;
}

// ─── Supabase client ────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_NORDIC_URL;
  const key =
    process.env.SUPABASE_NORDIC_SECRET_KEY ||
    process.env.SUPABASE_NORDIC_SERVICE_KEY ||
    process.env.SUPABASE_NORDIC_ANON_KEY;
  if (!url || !key) {
    console.error(
      [
        '✗ Missing Supabase env vars.',
        '  Required: SUPABASE_NORDIC_URL and one of:',
        '    SUPABASE_NORDIC_SECRET_KEY  (preferred — new sb_secret_* format)',
        '    SUPABASE_NORDIC_SERVICE_KEY (legacy JWT — only if re-enabled)',
        '    SUPABASE_NORDIC_ANON_KEY    (fallback — may fail on RLS)',
        '  Add these to apps/nordic-sqr-rct/.env.local before running.',
      ].join('\n'),
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_NORDIC_SECRET_KEY && !process.env.SUPABASE_NORDIC_SERVICE_KEY) {
    console.warn(
      '⚠ Using SUPABASE_NORDIC_ANON_KEY — RLS may block writes. Secret/service key recommended.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Notion client ───────────────────────────────────────────────────
// The `notion` wrapper imported above handles v5 API compat automatically.
// No separate init needed — just verify the token is present.
function getNotion() {
  if (!process.env.NOTION_TOKEN) {
    console.error('✗ Missing NOTION_TOKEN env var. Add it to .env.local before running.');
    process.exit(1);
  }
  return notion;
}

// ─── Page parsers ────────────────────────────────────────────────────
// Replicated from src/lib/aics-documents.js. Kept here so this script
// has no runtime dependency on that module (and its Postgres-read-path
// imports / env-flag side-effects). Never imported — inline only.

function parseAicsDocumentPage(page) {
  const p = page.properties;

  // Property-key lookups use the same PROPS.aicsDocuments mapping that
  // pcs-config.js exposes as PD.*. The Notion property names are:
  //   aicsId           → title column   ('AICS ID')
  //   aiName           → 'AI Name' rich_text
  //   classification   → 'Classification' select
  //   fileStatus       → 'File Status' select
  //   raReviewStatus   → 'RA Review Status' select
  //   documentNotes    → 'Document Notes' rich_text
  //   approvedDate     → 'Approved Date' date
  //   latestVersion    → 'Latest Version' relation
  //   allVersions      → 'All Versions' relation (rollup/relation)
  //   archived         → 'Archived' checkbox
  //   templateVersion  → 'Template Version' select
  //   templateSignals  → 'Template Signals' rich_text
  //
  // Rather than importing PCS_DB / PROPS (which pulls in supabase-pcs.js),
  // we read by property name directly. The name strings match exactly
  // what pcs-config.js exposes for aicsDocuments.

  const rt   = (prop) => (prop?.rich_text || []).map((t) => t.plain_text).join('');
  const sel  = (prop) => prop?.select?.name  || null;
  const rel  = (prop) => (prop?.relation || []).map((r) => r.id);
  const chk  = (prop) => prop?.checkbox      || false;
  const dt   = (prop) => prop?.date?.start   || null;
  const titl = (prop) => prop?.title?.[0]?.plain_text || '';

  // Derive field values by iterating page.properties and matching known
  // Notion display names. We use a helper that finds the value for a
  // given display name to be resilient to DB re-ordering.
  const prop = (name) => p[name];

  return {
    id:              page.id,
    aicsId:          titl(prop('AICS ID')),
    aiName:          rt(prop('AI Name')),
    classification:  sel(prop('Classification')),
    fileStatus:      sel(prop('File Status')),
    raReviewStatus:  sel(prop('RA Review Status')),
    documentNotes:   rt(prop('Document Notes')),
    approvedDate:    dt(prop('Approved Date')),
    latestVersionId: rel(prop('Latest Version'))[0] || null,
    allVersionIds:   rel(prop('All Versions')),
    archived:        chk(prop('Archived')),
    templateVersion: sel(prop('Template Version')),
    templateSignals: rt(prop('Template Signals')),
    createdTime:     page.created_time,
    lastEditedTime:  page.last_edited_time,
  };
}

function parseAicsVersionPage(page) {
  const p    = page.properties;
  const rt   = (prop) => (prop?.rich_text || []).map((t) => t.plain_text).join('');
  const sel  = (prop) => prop?.select?.name  || null;
  const rel  = (prop) => (prop?.relation || []).map((r) => r.id);
  const chk  = (prop) => prop?.checkbox      || false;
  const dt   = (prop) => prop?.date?.start   || null;
  const titl = (prop) => prop?.title?.[0]?.plain_text || '';
  const prop = (name) => p[name];

  return {
    id:                    page.id,
    version:               titl(prop('Version')),
    aicsDocumentId:        rel(prop('AICS Document'))[0] || null,
    isLatest:              chk(prop('Is Latest')),
    effectiveDate:         dt(prop('Effective Date')),
    changeDescription:     rt(prop('Change Description')),
    responsibleDept:       sel(prop('Responsible Dept')),
    responsibleIndividual: rt(prop('Responsible Individual')),
    approvedBy:            rt(prop('Approved By')),
    claimIds:              rel(prop('Claims')),
    latestVersionOfId:     rel(prop('Latest Version Of'))[0] || null,
    createdTime:           page.created_time,
    lastEditedTime:        page.last_edited_time,
  };
}

function parseAicsClaimPage(page) {
  const p    = page.properties;
  const rt   = (prop) => (prop?.rich_text || []).map((t) => t.plain_text).join('');
  const sel  = (prop) => prop?.select?.name  || null;
  const msel = (prop) => (prop?.multi_select || []).map((s) => s.name);
  const rel  = (prop) => (prop?.relation || []).map((r) => r.id);
  const chk  = (prop) => prop?.checkbox      || false;
  const num  = (prop) => prop?.number        ?? null;
  const titl = (prop) => prop?.title?.[0]?.plain_text || '';
  const prop = (name) => p[name];

  // claimId = Notion title; claimText = rich_text narrative (falls through
  // to title if the rich_text is empty, matching aics-documents.js logic).
  const claimTextRt = rt(prop('Claim'));
  const claimTitleTxt = titl(prop('Claim Text'));

  return {
    id:                          page.id,
    claimId:                     claimTitleTxt,
    claimText:                   claimTextRt || claimTitleTxt,
    claimNo:                     num(prop('Claim No')),
    claimStatus:                 sel(prop('Claim Status')),
    benefitCategory:             sel(prop('Benefit Category')),
    claimPrefix:                 rt(prop('Claim Prefix')) || null,
    aicsDocumentId:              rel(prop('AICS Document'))[0] || null,
    aicsVersionId:               rel(prop('AICS Version'))[0] || null,
    ageGroup:                    sel(prop('Age Group')),
    sex:                         sel(prop('Sex')),
    lifeStage:                   msel(prop('Life Stage')),
    lifestyleTags:               msel(prop('Lifestyle Tags')),
    minDose:                     num(prop('Min Dose')),
    minDoseUnit:                 sel(prop('Min Dose Unit')),
    minDoseSecondary:            num(prop('Min Dose Secondary')),
    minDoseSecondaryUnit:        sel(prop('Min Dose Secondary Unit')),
    grade:                       sel(prop('Grade')),
    fdaDsheaDisclaimerRequired:  chk(prop('FDA DSHEA Disclaimer Required')),
    substantiatingRefs:          rt(prop('Substantiating Refs')),
    regulatoryMonographs:        rt(prop('Regulatory Monographs')),
    safetyLimit:                 num(prop('Safety Limit')),
    safetyLimitUnit:             sel(prop('Safety Limit Unit')),
    safetyNotes:                 rt(prop('Safety Notes')),
    createdTime:                 page.created_time,
    lastEditedTime:              page.last_edited_time,
  };
}

// ─── Notion full-table paginator ─────────────────────────────────────
/**
 * Fetch every page from a Notion database, handling pagination.
 * Returns an array of raw Notion page objects.
 */
async function fetchAllNotionPages(notion, databaseId, tableName) {
  if (!databaseId) {
    console.warn(`[${tableName}]   ⚠ No database ID configured — skipping.`);
    return [];
  }

  let all = [];
  let cursor;
  let pageCount = 0;
  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      page_size:   PAGE_SIZE,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    all    = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pageCount++;
    if (res.has_more) {
      process.stdout.write(`\r[${tableName}]   fetched ${all.length} rows (page ${pageCount})...`);
    }
  } while (cursor);

  if (pageCount > 1) process.stdout.write('\n');
  return all;
}

// ─── Per-table runner ─────────────────────────────────────────────────
async function backfillTable(supabase, notion, descriptor, summary) {
  const { table, databaseId, parser, columnMap } = descriptor;
  const t0 = Date.now();
  console.log(`[${table}] fetching from Notion...`);

  let raw;
  try {
    raw = await fetchAllNotionPages(notion, databaseId, table);
  } catch (err) {
    console.error(`[${table}]   ✗ Notion fetch failed: ${err.message}`);
    summary.push({
      table, notionRows: 0, written: 0, errors: 1,
      durationMs: Date.now() - t0, fetchFailed: true,
    });
    return;
  }

  const fetchMs = Date.now() - t0;
  console.log(`[${table}]   got ${raw.length} rows in ${fmtMs(fetchMs)}`);

  if (raw.length === 0) {
    summary.push({ table, notionRows: 0, written: 0, errors: 0, durationMs: Date.now() - t0 });
    return;
  }

  const rows = raw.map((page) => notionShapeToPgRow(parser(page), columnMap));

  const batches     = chunk(rows, BATCH_SIZE);
  let writtenTotal  = 0;
  let errorCount    = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch  = batches[i];
    const tBatch = Date.now();
    console.log(`[${table}] upserting batch ${i + 1}/${batches.length} (${batch.length} rows)...`);

    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'notion_page_id', count: 'exact' });

    if (error) {
      errorCount++;
      console.error(`[${table}]   ✗ batch ${i + 1} failed: ${error.message}`);
      if (error.details) console.error(`[${table}]     details: ${error.details}`);
      if (error.hint)    console.error(`[${table}]     hint:    ${error.hint}`);
      // Keep going — per-batch failures shouldn't halt the whole backfill.
      continue;
    }
    writtenTotal += count ?? batch.length;
    console.log(`[${table}]   ✓ batch done in ${fmtMs(Date.now() - tBatch)}`);
  }

  summary.push({
    table,
    notionRows: raw.length,
    written:    writtenTotal,
    errors:     errorCount,
    durationMs: Date.now() - t0,
  });
}

// ─── Summary printer ──────────────────────────────────────────────────
function printSummary(summary) {
  const headers = ['table', 'notion_rows', 'pg_written', 'errors', 'duration'];
  const widths  = [20, 12, 11, 7, 10];
  const pad     = (s, w) => String(s).padEnd(w);

  console.log('');
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' '));
  console.log(widths.map((w) => '─'.repeat(w)).join(' '));

  let totals = { rows: 0, written: 0, errors: 0, ms: 0 };
  for (const r of summary) {
    const note = r.fetchFailed ? ' (fetch failed)' : '';
    console.log(
      [
        pad(r.table,      widths[0]),
        pad(r.notionRows, widths[1]),
        pad(r.written,    widths[2]),
        pad(r.errors,     widths[3]),
        pad(fmtMs(r.durationMs) + note, widths[4]),
      ].join(' '),
    );
    totals.rows    += r.notionRows;
    totals.written += r.written;
    totals.errors  += r.errors;
    totals.ms      += r.durationMs;
  }
  console.log(widths.map((w) => '─'.repeat(w)).join(' '));
  console.log(
    [
      pad('TOTAL',        widths[0]),
      pad(totals.rows,    widths[1]),
      pad(totals.written, widths[2]),
      pad(totals.errors,  widths[3]),
      pad(fmtMs(totals.ms), widths[4]),
    ].join(' '),
  );
  console.log('');
}

// ─── Table descriptors ────────────────────────────────────────────────
// Order: documents → versions → claims (parent before child, matching FKs).
const TABLES = [
  {
    table:      'aics_documents',
    databaseId: AICS_DOCUMENTS_DB,
    parser:     parseAicsDocumentPage,
    columnMap:  AICS_DOCUMENTS_PG_COLUMN_MAP,
  },
  {
    table:      'aics_versions',
    databaseId: AICS_VERSIONS_DB,
    parser:     parseAicsVersionPage,
    columnMap:  AICS_VERSIONS_PG_COLUMN_MAP,
  },
  {
    table:      'aics_claims',
    databaseId: AICS_CLAIMS_DB,
    parser:     parseAicsClaimPage,
    columnMap:  AICS_CLAIMS_PG_COLUMN_MAP,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('─── AICS → Supabase backfill ───');
  if (ONLY_TABLE) console.log(`Filter: --table=${ONLY_TABLE}`);
  console.log('');

  const supabase = getSupabase();
  const notion   = getNotion();

  let toRun = TABLES;
  if (ONLY_TABLE) {
    toRun = toRun.filter((t) => t.table === ONLY_TABLE);
    if (toRun.length === 0) {
      console.error(
        `✗ Unknown table "${ONLY_TABLE}". Valid values: aics_documents, aics_versions, aics_claims`,
      );
      process.exit(1);
    }
  }

  const summary = [];
  for (const descriptor of toRun) {
    await backfillTable(supabase, notion, descriptor, summary);
  }

  printSummary(summary);

  const totalErrors = summary.reduce((acc, r) => acc + r.errors, 0);
  process.exit(totalErrors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('✗ Fatal:', err);
  process.exit(1);
});
