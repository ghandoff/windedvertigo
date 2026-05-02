#!/usr/bin/env node
/**
 * Wave 4.5.5 — Confidence backfill from retained extraction JSON.
 *
 * Walks committed PCS Import Jobs (status=Completed) and, for each job that
 * still has `extractedData` JSON retained on the Notion row, matches the
 * extraction's per-item `confidence` scores back onto the PCS Claims /
 * Formula Lines / Evidence Packets rows that were committed from that job.
 *
 * Matching strategy (forward-only — no retro re-extraction):
 *   - Claims       : match by `claimNo` within the job's PCS Version.
 *   - Formula Lines: match by `fmPlm` else `ai + aiForm` within the version.
 *   - Evidence Pkts: match by `keyTakeaway` (first 80 chars) within each claim.
 *
 * Rows that were committed BEFORE Wave 4.5.5 shipped won't have extraction JSON
 * retained for jobs outside the current retention window — those are forward-
 * only and will stay null until their next re-import.
 *
 *   node scripts/backfill-confidence-from-extractions.mjs --dry-run --limit=5
 *   node scripts/backfill-confidence-from-extractions.mjs --job-id=<notion-page-id>
 *   node scripts/backfill-confidence-from-extractions.mjs            # live, all completed jobs
 *
 * Flags:
 *   --dry-run        Preview mode; no Notion writes.
 *   --limit=N        Cap how many jobs are processed.
 *   --job-id=<id>    Target a single import-job page by Notion ID.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as scripts/backfill-low-confidence-requests.mjs) ──
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

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;
const jobIdArg = args.find(a => a.startsWith('--job-id='));
const JOB_ID = jobIdArg ? jobIdArg.slice('--job-id='.length) : null;

const { getAllJobs, getJob } = await import('../src/lib/pcs-import-jobs.js');
const { getVersionsForDocument } = await import('../src/lib/pcs-versions.js');
const { getClaimsForVersion, updateClaim } = await import('../src/lib/pcs-claims.js');
const { getFormulaLinesForVersion, updateFormulaLine } = await import('../src/lib/pcs-formula-lines.js');
const { getPacketsForClaim, updateEvidencePacket } = await import('../src/lib/pcs-evidence-packets.js');

console.log('\n=== Confidence backfill from extractions (Wave 4.5.5) ===');
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} jobs`);
if (JOB_ID) console.log(`Target: job ${JOB_ID}`);
console.log('');

// Pull jobs — either the targeted one or all completed with extractedData.
let jobs;
if (JOB_ID) {
  jobs = [await getJob(JOB_ID)];
} else {
  const all = await getAllJobs();
  jobs = all.filter(j => j.status === 'Completed' && j.createdDocumentId && j.extractedData);
}
console.log(`Jobs in scope: ${jobs.length}`);
const target = LIMIT ? jobs.slice(0, LIMIT) : jobs;

const agg = { jobsProcessed: 0, claimsUpdated: 0, formulaLinesUpdated: 0, packetsUpdated: 0, skipped: 0, errors: 0 };
const errors = [];

for (const job of target) {
  try {
    let extraction;
    try {
      extraction = JSON.parse(job.extractedData);
    } catch (e) {
      console.log(`[skip] ${job.jobId || job.id}: extractedData JSON parse failed: ${e?.message || e}`);
      agg.skipped += 1;
      continue;
    }

    const versions = await getVersionsForDocument(job.createdDocumentId);
    const latest = versions.find(v => v.isLatest)
      || versions.sort((a, b) => (b.lastEditedTime || '').localeCompare(a.lastEditedTime || ''))[0];
    if (!latest) {
      console.log(`[skip] ${job.jobId || job.id}: no version found for doc ${job.createdDocumentId}`);
      agg.skipped += 1;
      continue;
    }

    const claims = await getClaimsForVersion(latest.id);
    const formulaLines = await getFormulaLinesForVersion(latest.id);

    const extractedClaims = Array.isArray(extraction.claims) ? extraction.claims : [];
    const extractedLines = Array.isArray(extraction.formulaLines) ? extraction.formulaLines : [];
    const extractedPackets = Array.isArray(extraction.evidencePackets) ? extraction.evidencePackets : [];

    // Claims — match by claimNo, update if confidence is missing on the row.
    let claimsUpdated = 0;
    for (const ec of extractedClaims) {
      if (typeof ec.confidence !== 'number') continue;
      const row = claims.find(c => String(c.claimNo) === String(ec.claimNo));
      if (!row) continue;
      if (row.confidence != null) continue; // skip if already set
      if (!dryRun) await updateClaim(row.id, { confidence: ec.confidence });
      claimsUpdated += 1;
    }

    // Formula lines — match by fmPlm, fall back to ai+aiForm.
    let linesUpdated = 0;
    for (const el of extractedLines) {
      if (typeof el.confidence !== 'number') continue;
      let row = null;
      if (el.fmPlm) row = formulaLines.find(f => f.fmPlm === el.fmPlm);
      if (!row && el.ai) {
        row = formulaLines.find(f => f.ai === el.ai && (f.aiForm || '') === (el.aiForm || ''));
      }
      if (!row) continue;
      if (row.confidence != null) continue;
      if (!dryRun) await updateFormulaLine(row.id, { confidence: el.confidence });
      linesUpdated += 1;
    }

    // Evidence packets — match by claimNo + keyTakeaway prefix (80 chars, mirroring commitExtraction naming).
    let packetsUpdated = 0;
    for (const ep of extractedPackets) {
      if (typeof ep.confidence !== 'number') continue;
      const claimNos = Array.isArray(ep.claimNos) ? ep.claimNos : [];
      for (const claimNo of claimNos) {
        const claimRow = claims.find(c => String(c.claimNo) === String(claimNo));
        if (!claimRow) continue;
        const packets = await getPacketsForClaim(claimRow.id);
        const needle = (ep.keyTakeaway || '').substring(0, 80);
        const row = needle
          ? packets.find(p => p.keyTakeaway?.startsWith(needle) || p.name?.startsWith(needle))
          : null;
        if (!row) continue;
        if (row.confidence != null) continue;
        if (!dryRun) await updateEvidencePacket(row.id, { confidence: ep.confidence });
        packetsUpdated += 1;
      }
    }

    agg.jobsProcessed += 1;
    agg.claimsUpdated += claimsUpdated;
    agg.formulaLinesUpdated += linesUpdated;
    agg.packetsUpdated += packetsUpdated;

    console.log(`[ok]  ${job.jobId || job.id} → claims=${claimsUpdated} formulaLines=${linesUpdated} packets=${packetsUpdated}`);
  } catch (err) {
    agg.errors += 1;
    errors.push({ jobId: job.jobId || job.id, error: err?.message || String(err) });
    console.error(`[fail] ${job.jobId || job.id}: ${err?.message || err}`);
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({ dryRun, scope: jobs.length, processed: target.length, agg }, null, 2));

if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) console.log(`  ${e.jobId}: ${e.error}`);
  process.exit(1);
}
