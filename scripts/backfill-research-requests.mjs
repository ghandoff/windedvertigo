#!/usr/bin/env node
/**
 * Backfill Research Requests for existing PCS Documents that drift from
 * the Lauren v1.0 template (Wave 4.5.0 — added 2026-04-21).
 *
 * Iterates every PCS Document where `templateVersion` is either
 * `Legacy pre-Lauren` or `Lauren v1.0 partial` (set by Wave 3.7's
 * backfill-template-classification.mjs) and upserts a `template-drift`
 * request per §8 of docs/plans/wave-4.5-extractor-validation.md.
 *
 *   node scripts/backfill-research-requests.mjs              # live, all legacy/partial docs
 *   node scripts/backfill-research-requests.mjs --dry-run    # preview only (no Notion writes)
 *   node scripts/backfill-research-requests.mjs --limit=5    # cap batch size
 *   node scripts/backfill-research-requests.mjs --dry-run --limit=10
 *
 * The dedup key inside upsertRequest() prevents duplicates if this script is
 * re-run. Done requests are never reopened — resolving one and re-running
 * the script will create a fresh row with its own audit trail.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as scripts/backfill-template-classification.mjs) ─
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

if (!process.env.NOTION_TOKEN) {
  console.error('Missing required env: NOTION_TOKEN');
  process.exit(1);
}
if (!process.env.NOTION_PCS_REQUESTS_DB) {
  console.error('Missing required env: NOTION_PCS_REQUESTS_DB');
  process.exit(1);
}

// ─── Parse args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

// ─── Load libs (dynamic so env is populated first) ──────────────────────────
const { getAllDocuments } = await import('../src/lib/pcs-documents.js');
const { upsertRequest } = await import('../src/lib/pcs-request-generator.js');
const { getVersionsForDocument } = await import('../src/lib/pcs-versions.js');

console.log('\n=== Research Requests backfill (template-drift) ===');
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} documents`);
console.log('');

const allDocs = await getAllDocuments();
console.log(`Fetched ${allDocs.length} PCS Documents`);

const DRIFT_VERSIONS = new Set(['Legacy pre-Lauren', 'Lauren v1.0 partial']);
const drift = allDocs.filter(d => DRIFT_VERSIONS.has(d.templateVersion));
console.log(`  Legacy pre-Lauren:    ${allDocs.filter(d => d.templateVersion === 'Legacy pre-Lauren').length}`);
console.log(`  Lauren v1.0 partial:  ${allDocs.filter(d => d.templateVersion === 'Lauren v1.0 partial').length}`);
console.log(`  → ${drift.length} documents in scope`);

const target = LIMIT ? drift.slice(0, LIMIT) : drift;

const actionCounts = { created: 0, updated: 0, skipped: 0, errors: 0 };
const errors = [];

for (const doc of target) {
  try {
    const isLegacy = doc.templateVersion === 'Legacy pre-Lauren';
    const priority = isLegacy ? 'High' : 'Normal';

    // Prefer the latest version's page id for the PCS Version relation.
    let versionId = null;
    try {
      const versions = await getVersionsForDocument(doc.id);
      const latest = versions.find(v => v.isLatest)
        || versions.sort((a, b) => (b.lastEditedTime || '').localeCompare(a.lastEditedTime || ''))[0];
      versionId = latest?.id || null;
    } catch (_err) {
      // Version lookup is best-effort; we can still create the request without it.
    }

    const signalsText = doc.templateSignals || '';
    const notes = [
      `Template classified as "${doc.templateVersion}".`,
      signalsText ? `Classifier signals:\n${signalsText}` : '',
      isLegacy ? 'This document predates the Lauren v1.0 template and should be re-issued.' : '',
    ].filter(Boolean).join('\n');

    const label = `${dryRun ? '[dry]' : '[ok]'} ${doc.pcsId} (${doc.templateVersion}) → template-drift / ${priority}`;

    if (dryRun) {
      console.log(label);
      console.log(`       title: Template drift: ${doc.templateVersion} — ${doc.pcsId}`);
      console.log(`       role:  Template-owner`);
      console.log(`       notes: ${notes.replace(/\n/g, ' | ').slice(0, 180)}${notes.length > 180 ? '…' : ''}`);
      actionCounts.created += 1; // preview assumes fresh rows
      continue;
    }

    const res = await upsertRequest({
      documentId: doc.id,
      versionId,
      type: 'template-drift',
      specificField: 'template-version',
      title: `Template drift: ${doc.templateVersion} — ${doc.pcsId}`,
      notes,
      assignedRole: 'Template-owner',
      priority,
      source: 'nightly-sweep', // retrospective sweep, per plan §8
    });
    actionCounts[res.action] = (actionCounts[res.action] || 0) + 1;
    console.log(`${label} → ${res.action} ${res.id || ''}`);
  } catch (err) {
    console.error(`[fail] ${doc.pcsId}: ${err?.message || err}`);
    errors.push({ pcsId: doc.pcsId, error: err?.message || String(err) });
    actionCounts.errors += 1;
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({
  dryRun,
  scope: drift.length,
  processed: target.length,
  actionCounts,
  errorCount: errors.length,
}, null, 2));

if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) console.log(`  ${e.pcsId}: ${e.error}`);
  process.exit(1);
}
