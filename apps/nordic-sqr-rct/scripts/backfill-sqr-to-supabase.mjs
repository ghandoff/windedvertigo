#!/usr/bin/env node
// scripts/backfill-sqr-to-supabase.mjs
// ─────────────────────────────────────────────────────────────────────
// One-time backfill of all SQR-RCT Notion data into Supabase Postgres.
//
// Pulls from Notion directly (paginating each SQR-RCT database), parses
// rows using the same logic as src/lib/sqr-reviewers.js, sqr-intakes.js,
// and sqr-scores.js, and upserts into the public.reviewers / intakes /
// scores tables defined in:
//   supabase/migrations/20260501221100_001_initial_schema.sql
//   supabase/migrations/20260514000001_008_sqr_schema_gaps.sql
//
// Idempotent: re-running refreshes existing rows by `notion_page_id`.
//
// Run (after ensuring .env.local has the required SQR env vars):
//   cd apps/nordic-sqr-rct
//   node --env-file=.env.local scripts/backfill-sqr-to-supabase.mjs
//
// Flags:
//   --table=<reviewers|intakes|scores>
//       Only backfill one table. If absent, runs all three in order
//       (reviewers → intakes → scores).
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
const REVIEWER_DB = process.env.NOTION_REVIEWER_DB;
const INTAKE_DB   = process.env.NOTION_INTAKE_DB;
const SCORES_DB   = process.env.NOTION_SCORES_DB;

// ─── Column-name overrides (camelCase → Postgres column) ────────────
// Most camelCase fields follow mechanical camelCase → snake_case.
// Only fields that deviate from that rule are listed here.
const REVIEWERS_PG_COLUMN_MAP = {};
const INTAKES_PG_COLUMN_MAP   = { pdf: 'pdf_url' };
const SCORES_PG_COLUMN_MAP    = { timestamp: 'scored_at' };

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
// Replicated from src/lib/sqr-reviewers.js, sqr-intakes.js, sqr-scores.js.
// Kept here so this script has no runtime dependency on those modules
// (and their Postgres-read-path imports / env-flag side-effects).
// Never imported — inline only.

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map((t) => t.plain_text).join('');
}

function parseReviewerPage(page) {
  const p = page.properties;
  const profileImageUrl = extractRichText(p['Profile Image']) || null;
  const isAdmin = p['Admin']?.checkbox || false;
  const explicitRoles = (p['Roles']?.multi_select || []).map((s) => s.name);
  // Backwards-compatible: derive roles from Admin checkbox when Roles is empty
  const roles = explicitRoles.length > 0
    ? explicitRoles
    : isAdmin
      ? ['sqr-rct', 'pcs', 'admin']
      : ['sqr-rct'];
  return {
    id: page.id,
    firstName: extractTitle(p['First Name']),
    lastName: extractRichText(p['Last Name (Surname)']),
    email: p['Email']?.email || '',
    affiliation: extractRichText(p['Affiliation']),
    affiliationType: p['Affiliation Type']?.select?.name || '',
    alias: extractRichText(p['Alias']),
    discipline: extractRichText(p['Discipline/Specialty']),
    domainExpertise: (p['Domain expertise']?.multi_select || []).map((s) => s.name),
    yearsExperience: p['Years of Experience']?.number || null,
    consent: p['Consent']?.checkbox || false,
    trainingCompleted: p['Training Completed']?.checkbox || false,
    isAdmin,
    roles,
    onboardingDate: p['Onboarding Date']?.date?.start || null,
    profileImageUrl,
    passwordResetRequired: p['Password reset required']?.checkbox || false,
    emailConfirmedAt: p['Email confirmed at']?.date?.start || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
  // Note: `password` / `passwordHash` are intentionally absent from this shape.
  // The `password_hash` column is populated directly by auth writes and must
  // never be overwritten from Notion data. The unconditional delete below in
  // backfillTable() is a belt-and-suspenders guard.
}

function extractFileUrl(prop) {
  const file = prop?.files?.[0];
  if (!file) return null;
  return file.external?.url || file.file?.url || null;
}

function parseIntakePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    citation: extractTitle(p['Citation']),
    doi: p['DOI']?.url || '',
    year: p['Year']?.number || null,
    journal: extractRichText(p['Journal']),
    purposeOfResearch: extractRichText(p['Purpose of Research']),
    studyDesign: extractRichText(p['Study Design']),
    fundingSources: extractRichText(p['Funding Source(s)']),
    inclusionCriteria: extractRichText(p['Inclusion Criteria']),
    exclusionCriteria: extractRichText(p['Exclusion Criteria']),
    recruitment: extractRichText(p['Recruitment']),
    blinding: p['Blinding']?.select?.name || '',
    initialN: p['Initial N']?.number || null,
    ages: extractRichText(p['Ages (group means)']),
    femaleParticipants: p['Female Participants']?.number || null,
    maleParticipants: p['Male Participants']?.number || null,
    finalN: p['Final N']?.number || null,
    aPrioriPower: p['A Priori Power Estimation']?.select?.name || '',
    locationCountry: extractRichText(p['Location of Study (Country)']),
    locationCity: extractRichText(p['Location of Study (City)']),
    timingOfMeasures: extractRichText(p['Timing of Measures']),
    independentVariables: extractRichText(p['Independent Variables']),
    dependentVariables: extractRichText(p['Dependent Variables']),
    controlVariables: extractRichText(p['Control Variables']),
    keyResults: extractRichText(p['Key Results']),
    otherResults: extractRichText(p['Other Results']),
    statisticalMethods: extractRichText(p['Statistical Methods']),
    missingDataHandling: extractRichText(p['Missing Data Handling']),
    authorsConclusion: extractRichText(p['Authors\' Conclusion']),
    strengths: extractRichText(p['Strengths']),
    limitations: extractRichText(p['Limitations']),
    potentialBiases: extractRichText(p['Potential Biases']),
    submittedByAlias: extractRichText(p['Submitted by Alias']),
    pdf: extractFileUrl(p['PDF']),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

function parseScorePage(page) {
  const p = page.properties;
  const extractScore = (val) => {
    const name = val?.select?.name || '';
    const match = name.match(/^(\d)/);
    return match ? Number(match[1]) : null;
  };
  return {
    id: page.id,
    scoreId: extractTitle(p['Score ID']),
    studyRelation: (p['Study']?.relation || []).map((r) => r.id),
    reviewerRelation: (p['Reviewer']?.relation || []).map((r) => r.id),
    raterAlias: p['Rater Alias']?.select?.name || '',
    q1: extractScore(p['Q1 Research Question']),
    q2: extractScore(p['Q2 Randomization']),
    q3: extractScore(p['Q3 Blinding']),
    q4: extractScore(p['Q4 Sample Size']),
    q5: extractScore(p['Q5 Baseline Characteristics']),
    q6: extractScore(p['Q6 Participant Flow']),
    q7: extractScore(p['Q7 Intervention Description']),
    q8: extractScore(p['Q8 Outcome Measurement']),
    q9: extractScore(p['Q9 Statistical Analysis']),
    q10: extractScore(p['Q10 Bias Assessment']),
    q11: extractScore(p['Q11 Applicability']),
    q1Raw: p['Q1 Research Question']?.select?.name || '',
    q2Raw: p['Q2 Randomization']?.select?.name || '',
    q3Raw: p['Q3 Blinding']?.select?.name || '',
    q4Raw: p['Q4 Sample Size']?.select?.name || '',
    q5Raw: p['Q5 Baseline Characteristics']?.select?.name || '',
    q6Raw: p['Q6 Participant Flow']?.select?.name || '',
    q7Raw: p['Q7 Intervention Description']?.select?.name || '',
    q8Raw: p['Q8 Outcome Measurement']?.select?.name || '',
    q9Raw: p['Q9 Statistical Analysis']?.select?.name || '',
    q10Raw: p['Q10 Bias Assessment']?.select?.name || '',
    q11Raw: p['Q11 Applicability']?.select?.name || '',
    rubricVersion: p['Rubric version']?.select?.name || '',
    notes: extractRichText(p['Notes']),
    // `timestamp` is the Notion shape key; maps to `scored_at` in Postgres
    // via SCORES_PG_COLUMN_MAP (reserved-word avoidance).
    timestamp: p['Timestamp']?.date?.start || page.created_time,
    timeToComplete: p['Time to Complete (minutes)']?.number || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
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
  const { table, databaseId, parser, columnMap, postProcess } = descriptor;
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

  const rows = raw.map((page) => {
    const row = notionShapeToPgRow(parser(page), columnMap);
    if (postProcess) postProcess(row);
    return row;
  });

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
// Order: reviewers → intakes → scores (parent before child, matching FKs).
const TABLES = [
  {
    table:      'reviewers',
    databaseId: REVIEWER_DB,
    parser:     parseReviewerPage,
    columnMap:  REVIEWERS_PG_COLUMN_MAP,
    // Safety: never overwrite bcrypt hashes from Notion data.
    // `parseReviewerPage` never returns a `password` or `passwordHash` key,
    // but this unconditional delete is belt-and-suspenders.
    postProcess: (row) => { delete row.password_hash; },
  },
  {
    table:      'intakes',
    databaseId: INTAKE_DB,
    parser:     parseIntakePage,
    columnMap:  INTAKES_PG_COLUMN_MAP,
  },
  {
    table:      'scores',
    databaseId: SCORES_DB,
    parser:     parseScorePage,
    columnMap:  SCORES_PG_COLUMN_MAP,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('─── SQR-RCT → Supabase backfill ───');
  if (ONLY_TABLE) console.log(`Filter: --table=${ONLY_TABLE}`);
  console.log('');

  const supabase = getSupabase();
  const notionClient = getNotion();

  let toRun = TABLES;
  if (ONLY_TABLE) {
    toRun = toRun.filter((t) => t.table === ONLY_TABLE);
    if (toRun.length === 0) {
      console.error(
        `✗ Unknown table "${ONLY_TABLE}". Valid values: reviewers, intakes, scores`,
      );
      process.exit(1);
    }
  }

  const summary = [];
  for (const descriptor of toRun) {
    await backfillTable(supabase, notionClient, descriptor, summary);
  }

  printSummary(summary);

  const totalErrors = summary.reduce((acc, r) => acc + r.errors, 0);
  process.exit(totalErrors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('✗ Fatal:', err);
  process.exit(1);
});
