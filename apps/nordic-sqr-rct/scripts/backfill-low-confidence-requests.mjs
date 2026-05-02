#!/usr/bin/env node
/**
 * Wave 4.6 — retrospective low-confidence Research Request sweep.
 *
 * The Wave 4.5.0 generator (`src/lib/pcs-request-generator.js`) runs inside
 * `commitExtraction` on every new PCS import. This script walks already-imported
 * PCS Documents and calls the same generator so any low-confidence or per-item
 * confidence signals surface as Requests rows even if the doc was imported
 * before 4.5.0 shipped.
 *
 *   node scripts/backfill-low-confidence-requests.mjs --dry-run --limit=3
 *   node scripts/backfill-low-confidence-requests.mjs --pcs-id=PCS-0126
 *   node scripts/backfill-low-confidence-requests.mjs            # live, all docs
 *
 * Flags:
 *   --dry-run            Preview mode; no Notion writes.
 *   --limit=N            Cap how many documents are processed.
 *   --pcs-id=PCS-####    Target a single document by human ID.
 *
 * ─── Known limitation (Wave 4.6 open question) ──────────────────────────────
 * Per-item `confidence` fields on extraction JSON (PROMPT_VERSION v2.2-confidence)
 * are NOT persisted to the PCS claims / formula lines / evidence packets Notion
 * rows. The extraction JSON is transient — only present inside `commitExtraction`.
 *
 * As a result, this sweep can only raise low-confidence Requests when a future
 * enhancement persists the per-item score on each row (e.g. a `Confidence` number
 * property), OR when the sweep is extended to re-extract the source PDF.
 *
 * Until then this script is a safety net: it runs cleanly against every doc,
 * exercises `generateValidationRequests` + `upsertRequest` end-to-end, and will
 * start producing rows the moment confidence becomes readable. The template-drift
 * Loop B inside the generator is intentionally suppressed here — that sweep is
 * owned by scripts/backfill-research-requests.mjs and already ran in Wave 4.5.0.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as scripts/backfill-research-requests.mjs) ──────
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
const pcsIdArg = args.find(a => a.startsWith('--pcs-id='));
const PCS_ID = pcsIdArg ? pcsIdArg.slice('--pcs-id='.length) : null;

// ─── Load libs (dynamic so env is populated first) ──────────────────────────
const { getAllDocuments } = await import('../src/lib/pcs-documents.js');
const { getVersionsForDocument } = await import('../src/lib/pcs-versions.js');
const { getClaimsForVersion } = await import('../src/lib/pcs-claims.js');
const { getFormulaLinesForVersion } = await import('../src/lib/pcs-formula-lines.js');
const { getPacketsForClaim } = await import('../src/lib/pcs-evidence-packets.js');
const { generateValidationRequests } = await import('../src/lib/pcs-request-generator.js');

console.log('\n=== Low-confidence Research Requests backfill (Wave 4.6) ===');
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} documents`);
if (PCS_ID) console.log(`Target: ${PCS_ID}`);
console.log('');

const allDocs = await getAllDocuments();
console.log(`Fetched ${allDocs.length} PCS Documents`);

// Filter: not archived, optionally match pcs-id
let scope = allDocs.filter(d => !d.archived);
if (PCS_ID) {
  scope = scope.filter(d => d.pcsId === PCS_ID);
  if (scope.length === 0) {
    console.error(`No non-archived document found with pcsId=${PCS_ID}`);
    process.exit(1);
  }
}
console.log(`  → ${scope.length} non-archived documents in scope`);

const target = LIMIT ? scope.slice(0, LIMIT) : scope;

/**
 * Build a synthetic extraction object in the shape `generateValidationRequests`
 * expects. Per-item `confidence` is sourced from Notion row data when present —
 * today it is NOT stored (see header docblock) so this typically yields no
 * low-confidence rows. Shape matches Loop A's reader in pcs-request-generator.js.
 */
function synthesizeExtraction({ claims, formulaLines, evidencePackets }) {
  return {
    claims: claims.map(c => ({
      claim: c.claim,
      // `confidence` is not persisted on the row — left undefined so the walker skips it.
      confidence: typeof c.confidence === 'number' ? c.confidence : undefined,
    })),
    formulaLines: formulaLines.map(f => ({
      ai: f.ai,
      aiForm: f.aiForm,
      fmPlm: f.fmPlm,
      confidence: typeof f.confidence === 'number' ? f.confidence : undefined,
    })),
    evidencePackets: evidencePackets.map(p => ({
      keyTakeaway: p.keyTakeaway,
      confidence: typeof p.confidence === 'number' ? p.confidence : undefined,
    })),
    // `confidence.perField` also not persisted; leaving empty is safe.
    confidence: { perField: {} },
  };
}

const agg = { docsProcessed: 0, fieldsFlagged: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
const perDocErrors = [];

for (const doc of target) {
  try {
    // Resolve latest version.
    const versions = await getVersionsForDocument(doc.id);
    const latest = versions.find(v => v.isLatest)
      || versions.sort((a, b) => (b.lastEditedTime || '').localeCompare(a.lastEditedTime || ''))[0];
    if (!latest) {
      console.log(`[skip] ${doc.pcsId}: no version found`);
      agg.skipped += 1;
      continue;
    }

    const claims = await getClaimsForVersion(latest.id);
    const formulaLines = await getFormulaLinesForVersion(latest.id);

    // Evidence packets are keyed by claim. Collect across all claims.
    let evidencePackets = [];
    for (const c of claims) {
      const ps = await getPacketsForClaim(c.id);
      evidencePackets = evidencePackets.concat(ps);
    }

    const extraction = synthesizeExtraction({ claims, formulaLines, evidencePackets });

    // Count how many items carry numeric confidence that would trigger the walker.
    const confidenceBearing =
      extraction.claims.filter(c => typeof c.confidence === 'number').length +
      extraction.formulaLines.filter(f => typeof f.confidence === 'number').length +
      extraction.evidencePackets.filter(p => typeof p.confidence === 'number').length;

    if (dryRun) {
      console.log(`[dry] ${doc.pcsId} — ${claims.length} claims / ${formulaLines.length} formulaLines / ${evidencePackets.length} evidencePackets; confidence-bearing items: ${confidenceBearing}`);
      if (confidenceBearing === 0) {
        console.log(`       (no persisted confidence data — Loop A will find 0 fields)`);
      }
      agg.docsProcessed += 1;
      continue;
    }

    // IMPORTANT: call generateValidationRequests with templateVersion=null + no signals
    // so Loop B (template-drift) is suppressed here. That retrospective sweep is
    // owned by scripts/backfill-research-requests.mjs — we don't want to re-fire it.
    const stats = await generateValidationRequests({
      documentId: doc.id,
      versionId: latest.id,
      pcsId: doc.pcsId,
      extraction,
      templateVersion: null,
      templateSignals: null,
    });

    agg.docsProcessed += 1;
    agg.fieldsFlagged += confidenceBearing;
    agg.created += stats.created || 0;
    agg.updated += stats.updated || 0;
    agg.skipped += stats.skipped || 0;
    agg.errors += stats.errors || 0;

    const summary = `created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors}`;
    console.log(`[ok]  ${doc.pcsId} → ${summary}`);
  } catch (err) {
    agg.errors += 1;
    perDocErrors.push({ pcsId: doc.pcsId, error: err?.message || String(err) });
    console.error(`[fail] ${doc.pcsId}: ${err?.message || err}`);
  }
}

console.log('\n=== Summary ===');
console.log(`${agg.docsProcessed} docs processed, ${agg.fieldsFlagged} low-confidence fields found, ${agg.created} Requests created, ${agg.updated} updated, ${agg.skipped} skipped (dedup), ${agg.errors} errors`);
console.log(JSON.stringify({ dryRun, scope: scope.length, processed: target.length, agg }, null, 2));

if (perDocErrors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of perDocErrors) console.log(`  ${e.pcsId}: ${e.error}`);
  process.exit(1);
}
