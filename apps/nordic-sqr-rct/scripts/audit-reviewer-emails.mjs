#!/usr/bin/env node
/**
 * scripts/audit-reviewer-emails.mjs  —  Wave 7.3.0 Phase A
 *
 * READ-ONLY audit of the Reviewer Notion DB to surface email-column issues
 * that need to be resolved before Phase B (conflict resolution), Phase C
 * (banner), and Phase D (uniqueness constraint on email).
 *
 * The script never writes to Notion. No `.update()` or `.create()` calls.
 * No `--confirm` flag exists by design.
 *
 * Categories reported per row:
 *   missing           — Email cell empty / whitespace only
 *   malformed         — fails a basic local@domain.tld regex
 *   duplicate         — two or more rows share the same normalized email
 *                       (case-insensitive + trimmed)
 *   case-variance     — two rows whose emails differ only by case
 *                       (fix is different from a true duplicate)
 *   domain-mismatch   — OPT-IN (--include-domain-mismatch): internal-domain
 *                       email local-part doesn't appear to match the alias
 *   clean             — no issues
 *
 * Flags:
 *   --verbose                    per-row log
 *   --json                       emit the full findings object as JSON to stdout
 *   --output=<path>              write JSON report to <path>
 *   --include-domain-mismatch    enable the noisy domain-vs-alias heuristic
 *
 * Usage:
 *   node scripts/audit-reviewer-emails.mjs --verbose
 *   node scripts/audit-reviewer-emails.mjs --json --output=/tmp/email-audit.json
 *
 * Requires: NOTION_TOKEN + NOTION_REVIEWER_DB in environment (from .env.local).
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Env loading (same pattern as backfill-bcrypt-passwords.mjs) ─────────
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

// ─── Constants ────────────────────────────────────────────────────────────
export const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const INTERNAL_DOMAINS = Object.freeze(['nordicnaturals.com']);

export const CATEGORIES = Object.freeze({
  MISSING: 'missing',
  MALFORMED: 'malformed',
  DUPLICATE: 'duplicate',
  CASE_VARIANCE: 'case-variance',
  DOMAIN_MISMATCH: 'domain-mismatch',
  CLEAN: 'clean',
});

// ─── Pure logic (unit-testable; no Notion calls) ─────────────────────────

/**
 * Normalize an alias-side-or-localpart string to a delimiter-free,
 * casefolded form suitable for loose comparison. Strips dots, dashes,
 * underscores, and whitespace.
 */
export function stripAliasDelimiters(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\s._\-]+/g, '').toLowerCase();
}

/**
 * Classify a single reviewer row's email in isolation (no cross-row context).
 * Returns `{ category, detail }`. Duplicate + case-variance require whole-
 * dataset context and are assigned in a second pass.
 *
 * Options:
 *   includeDomainMismatch — when true, emails on an INTERNAL_DOMAINS host
 *     whose local-part doesn't casefold-match the alias (after delimiter
 *     stripping) are flagged as 'domain-mismatch'. Off by default.
 */
export function classifyEmail({ email, alias }, { includeDomainMismatch = false } = {}) {
  const raw = email == null ? '' : String(email);
  const trimmed = raw.trim();

  if (!trimmed) {
    return { category: CATEGORIES.MISSING, detail: 'email is empty or whitespace-only' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { category: CATEGORIES.MALFORMED, detail: `"${trimmed}" does not match local@domain.tld` };
  }

  if (includeDomainMismatch) {
    const atIdx = trimmed.lastIndexOf('@');
    const localPart = trimmed.slice(0, atIdx);
    const domain = trimmed.slice(atIdx + 1).toLowerCase();
    if (INTERNAL_DOMAINS.includes(domain)) {
      const strippedLocal = stripAliasDelimiters(localPart);
      const strippedAlias = stripAliasDelimiters(alias || '');
      if (strippedAlias && strippedLocal !== strippedAlias) {
        return {
          category: CATEGORIES.DOMAIN_MISMATCH,
          detail: `internal-domain local-part "${localPart}" does not match alias "${alias}"`,
        };
      }
    }
  }

  return { category: CATEGORIES.CLEAN, detail: '' };
}

/**
 * Build a Map<normalizedEmail, rowId[]> of exact-duplicate groups (2+ rows
 * with identical emails after trim + lowercase). Case-variance is a
 * SEPARATE concept handled by detectCaseVariance().
 *
 * An email is "exact duplicate" when two rows have IDENTICAL raw strings
 * (after trim). Case-variance is "same casefolded normalization, different
 * raw-trimmed strings".
 */
export function detectDuplicates(rows) {
  const byRaw = new Map();
  for (const r of rows) {
    const raw = (r.email || '').trim();
    if (!raw) continue;
    if (!byRaw.has(raw)) byRaw.set(raw, []);
    byRaw.get(raw).push(r.id);
  }
  const out = new Map();
  for (const [raw, ids] of byRaw.entries()) {
    if (ids.length >= 2) out.set(raw, ids);
  }
  return out;
}

/**
 * Build a Map<normalizedEmail, rowId[]> of case-variance groups: rows whose
 * emails fold to the same lowercased string but whose raw strings are NOT
 * all identical (i.e. at least one casing differs).
 */
export function detectCaseVariance(rows) {
  const byFolded = new Map();
  for (const r of rows) {
    const raw = (r.email || '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!byFolded.has(key)) byFolded.set(key, []);
    byFolded.get(key).push({ id: r.id, raw });
  }
  const out = new Map();
  for (const [folded, entries] of byFolded.entries()) {
    if (entries.length < 2) continue;
    const rawSet = new Set(entries.map(e => e.raw));
    if (rawSet.size >= 2) {
      out.set(folded, entries.map(e => e.id));
    }
  }
  return out;
}

// ─── Notion-facing plumbing ──────────────────────────────────────────────

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const JSON_OUT = args.includes('--json');
const INCLUDE_DOMAIN_MISMATCH = args.includes('--include-domain-mismatch');
const outputArg = args.find(a => a.startsWith('--output='));
const OUTPUT_PATH = outputArg ? outputArg.slice('--output='.length) : null;

function extractEmail(page) {
  return page.properties?.['Email']?.email ?? '';
}
function extractAlias(page) {
  return page.properties?.['Alias']?.rich_text?.[0]?.plain_text ?? '';
}
function extractFirstName(page) {
  return page.properties?.['First Name']?.title?.[0]?.plain_text ?? '';
}
function extractLastName(page) {
  return page.properties?.['Last Name (Surname)']?.rich_text?.[0]?.plain_text ?? '';
}

async function fetchAllReviewers(notion, dbId) {
  const out = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function main() {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_REVIEWER_DB = process.env.NOTION_REVIEWER_DB;
  if (!NOTION_TOKEN || !NOTION_REVIEWER_DB) {
    console.error('[audit-emails] Missing NOTION_TOKEN or NOTION_REVIEWER_DB in environment.');
    process.exit(1);
  }

  const { notion } = await import('../src/lib/notion.js');

  if (!JSON_OUT) {
    console.log(`[audit-emails] mode=READ-ONLY${VERBOSE ? ' verbose' : ''}${INCLUDE_DOMAIN_MISMATCH ? ' +domain-mismatch' : ''}`);
  }

  const pages = await fetchAllReviewers(notion, NOTION_REVIEWER_DB);
  if (!JSON_OUT) console.log(`[audit-emails] fetched ${pages.length} reviewer row(s)`);

  // Project to plain rows for pure-logic functions.
  const rows = pages.map(p => ({
    id: p.id,
    email: extractEmail(p),
    alias: extractAlias(p),
    firstName: extractFirstName(p),
    lastName: extractLastName(p),
  }));

  const duplicates = detectDuplicates(rows);
  const caseVariance = detectCaseVariance(rows);

  // Build quick lookup: rowId -> membership flag.
  const dupIds = new Set();
  for (const ids of duplicates.values()) ids.forEach(id => dupIds.add(id));
  const cvIds = new Set();
  for (const ids of caseVariance.values()) ids.forEach(id => cvIds.add(id));

  const perRow = [];
  const counts = {
    [CATEGORIES.MISSING]: 0,
    [CATEGORIES.MALFORMED]: 0,
    [CATEGORIES.DUPLICATE]: 0,
    [CATEGORIES.CASE_VARIANCE]: 0,
    [CATEGORIES.DOMAIN_MISMATCH]: 0,
    [CATEGORIES.CLEAN]: 0,
  };

  for (const r of rows) {
    // Precedence: cross-row duplicate beats individual classification only
    // if the individual classification would have been "clean". Missing /
    // malformed always wins over duplicate (you can't dedupe an empty cell).
    const individual = classifyEmail(r, { includeDomainMismatch: INCLUDE_DOMAIN_MISMATCH });
    let category = individual.category;
    let detail = individual.detail;

    if (category === CATEGORIES.CLEAN) {
      if (dupIds.has(r.id)) {
        category = CATEGORIES.DUPLICATE;
        detail = 'email shared with another reviewer row (exact match after trim)';
      } else if (cvIds.has(r.id)) {
        category = CATEGORIES.CASE_VARIANCE;
        detail = 'email casefolds to match another row but raw casing differs';
      }
    }

    counts[category] += 1;
    perRow.push({
      id: r.id,
      alias: r.alias,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      category,
      detail,
    });
  }

  const needsAttention = rows.length - counts[CATEGORIES.CLEAN];

  const report = {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    healthy: counts[CATEGORIES.CLEAN],
    needsAttention,
    counts,
    includeDomainMismatch: INCLUDE_DOMAIN_MISMATCH,
    duplicateGroups: Array.from(duplicates.entries()).map(([email, ids]) => ({ email, ids })),
    caseVarianceGroups: Array.from(caseVariance.entries()).map(([folded, ids]) => ({ folded, ids })),
    rows: perRow,
  };

  if (OUTPUT_PATH) {
    writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
    if (!JSON_OUT) console.log(`[audit-emails] wrote report to ${OUTPUT_PATH}`);
  }

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  if (VERBOSE) {
    console.log('');
    console.log('[audit-emails] per-row:');
    for (const row of perRow) {
      const label = row.alias || `${row.firstName} ${row.lastName}`.trim() || row.id;
      console.log(`  [${row.category.padEnd(15)}] ${label.padEnd(24)} ${row.email || '(empty)'}${row.detail ? '  — ' + row.detail : ''}`);
    }
  }

  console.log('');
  console.log('[audit-emails] summary:');
  console.log(`  total rows scanned:  ${rows.length}`);
  console.log(`  healthy (clean):     ${counts[CATEGORIES.CLEAN]}`);
  console.log(`  needs attention:     ${needsAttention}`);
  console.log('  per-category counts:');
  console.log(`    missing:           ${counts[CATEGORIES.MISSING]}`);
  console.log(`    malformed:         ${counts[CATEGORIES.MALFORMED]}`);
  console.log(`    duplicate:         ${counts[CATEGORIES.DUPLICATE]}`);
  console.log(`    case-variance:     ${counts[CATEGORIES.CASE_VARIANCE]}`);
  console.log(`    domain-mismatch:   ${counts[CATEGORIES.DOMAIN_MISMATCH]}${INCLUDE_DOMAIN_MISMATCH ? '' : ' (disabled; use --include-domain-mismatch)'}`);

  if (duplicates.size > 0) {
    console.log('');
    console.log(`[audit-emails] ${duplicates.size} exact-duplicate email group(s):`);
    for (const [email, ids] of duplicates.entries()) {
      console.log(`  ${email}  →  ${ids.length} rows: ${ids.join(', ')}`);
    }
  }
  if (caseVariance.size > 0) {
    console.log('');
    console.log(`[audit-emails] ${caseVariance.size} case-variance email group(s):`);
    for (const [folded, ids] of caseVariance.entries()) {
      console.log(`  ${folded}  →  ${ids.length} rows: ${ids.join(', ')}`);
    }
  }
}

// Only run main() when invoked as a script, not when imported by tests.
const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === __filename;
if (invokedAsScript) {
  main().catch(err => {
    console.error('[audit-emails] fatal:', err);
    process.exit(1);
  });
}
