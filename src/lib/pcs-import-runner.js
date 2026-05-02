/**
 * PCS Import worker — state machine that advances queued → committed.
 *
 * Designed to run under Vercel Cron (`/api/cron/process-imports`) with a
 * hard wall-clock budget (default 13 minutes). Each job is isolated so one
 * bad PDF doesn't kill the whole batch. Retry logic caps at 3 attempts per
 * phase before the job transitions to `failed`.
 *
 * Added 2026-04-19 as part of the batch-import feature (v1).
 */

import {
  getJobsByStatus,
  getJobsByBatch,
  getStaleJobs,
  updateJob,
} from './pcs-import-jobs.js';
import { extractFromPdf, commitExtraction, preflightCheckPdf } from './pcs-pdf-import.js';
import { runSanityChecks } from './pcs-sanity-checks.js';
import { notifyBatchComplete } from './slack-notifier.js';
import { computeExtractionDiff } from './pcs-version-diff.js';
import { getVersionsForDocument, getVersion } from './pcs-versions.js';
import { getClaimsForVersion } from './pcs-claims.js';
import { getFormulaLinesForVersion } from './pcs-formula-lines.js';
import { getDocument } from './pcs-documents.js';

const STALE_THRESHOLD_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;
const DEFAULT_DEADLINE_MS = 780_000; // 13 min — Vercel cron cap is 15

// Wave 3.8 — MIME types the extractor pipeline understands.
const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Infer the source MIME type from a filename. The Import Jobs Notion DB
 * doesn't persist Content-Type (would require a schema change), so we derive
 * it from the extension at worker time. Defaults to PDF for backward compat
 * with the thousands of historical PDF jobs.
 */
function mimeFromFilename(filename) {
  if (!filename) return MIME_PDF;
  if (/\.docx$/i.test(filename)) return MIME_DOCX;
  return MIME_PDF;
}

// Pessimistic per-job budgets so we can decide whether to start another one.
const EXTRACT_BUDGET_MS = 7 * 60 * 1000;
const COMMIT_BUDGET_MS  = 1 * 60 * 1000;

/**
 * Reset stale jobs stuck in a transient state back to their prior stable state.
 * Increments retryCount so perma-stuck rows eventually transition to `failed`.
 *
 * @param {(line: string) => void} log
 * @returns {Promise<number>} Count of jobs reset.
 */
async function sweepStale(log) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  let resets = 0;
  const extractingStale = await getStaleJobs('extracting', cutoff, 10);
  for (const job of extractingStale) {
    log(`[warn] stale extracting job ${job.jobId} (${job.pcsId || 'unknown'}) — resetting to queued`);
    await updateJob(job.id, {
      status: 'queued',
      retryCount: (job.retryCount || 0) + 1,
      error: `Reset from stale 'extracting' state at ${new Date().toISOString()}`,
    });
    resets++;
    if (resets >= 10) break;
  }
  if (resets < 10) {
    const committingStale = await getStaleJobs('committing', cutoff, 10 - resets);
    for (const job of committingStale) {
      log(`[warn] stale committing job ${job.jobId} (${job.pcsId || 'unknown'}) — resetting to extracted`);
      await updateJob(job.id, {
        status: 'extracted',
        retryCount: (job.retryCount || 0) + 1,
        error: `Reset from stale 'committing' state at ${new Date().toISOString()}`,
      });
      resets++;
      if (resets >= 10) break;
    }
  }
  return resets;
}

/**
 * If every peer in `batchId` is in a terminal state and none is flagged
 * `notificationSent`, fire a Slack notification and flag every peer so we
 * don't double-send on a subsequent tick. Fully fail-silent.
 *
 * @param {string} batchId
 * @param {(line: string) => void} log
 */
async function maybeNotifyBatchComplete(batchId, log) {
  if (!batchId) return;
  try {
    const peers = await getJobsByBatch(batchId);
    if (peers.length === 0) return;
    const terminal = ['committed', 'failed', 'skipped'];
    const allTerminal = peers.every(j => terminal.includes(j.status));
    if (!allTerminal) return;
    // Race-safety: if ANY peer already has notificationSent=true, skip.
    if (peers.some(j => j.notificationSent)) return;

    // Template-version breakdown across all committed peers (Wave 3.7).
    const templateCounts = { lauren: 0, partial: 0, legacy: 0, unknown: 0 };
    const legacyDocs = [];
    for (const j of peers) {
      if (j.status !== 'committed') continue;
      let parsed = null;
      if (j.resultCounts) {
        try { parsed = JSON.parse(j.resultCounts); } catch { /* ignore */ }
      }
      const tv = parsed?.templateVersion || 'Unknown';
      if (tv === 'Lauren v1.0') templateCounts.lauren++;
      else if (tv === 'Lauren v1.0 partial') templateCounts.partial++;
      else if (tv === 'Legacy pre-Lauren') {
        templateCounts.legacy++;
        legacyDocs.push({ pcsId: j.pcsId || j.jobId, productName: null });
      }
      else templateCounts.unknown++;
    }

    const stats = {
      committed: peers.filter(j => j.status === 'committed').length,
      failed: peers.filter(j => j.status === 'failed').length,
      skipped: peers.filter(j => j.status === 'skipped').length,
      total: peers.length,
      templateCounts,
    };

    // Aggregate + dedupe warnings across all peers (one line per warning).
    const warnSet = new Set();
    for (const j of peers) {
      if (j.warnings) {
        for (const w of j.warnings.split('\n')) {
          const trimmed = w.trim();
          if (trimmed) warnSet.add(trimmed);
        }
      }
    }

    const { sent, reason } = await notifyBatchComplete({
      batchId,
      stats,
      sanityWarnings: Array.from(warnSet),
      legacyDocs,
    });
    log(sent
      ? `[notify] Slack notification sent for batch ${batchId}`
      : `[notify] Skipped batch ${batchId}: ${reason}`);
    if (sent) {
      // Flag all peers so we don't double-send on subsequent ticks.
      for (const j of peers) {
        try { await updateJob(j.id, { notificationSent: true }); } catch { /* best-effort */ }
      }
    }
  } catch (err) {
    log(`[notify] Error checking batch ${batchId}: ${err?.message || err}`);
  }
}

/**
 * Process a single extraction-phase job. Mutates status on Notion.
 *
 * @param {object} job
 * @param {(line: string) => void} log
 * @returns {Promise<'ok'|'failed'|'retry'>}
 */
async function runExtractPhase(job, log) {
  log(`[info] extract start: ${job.jobId} (${job.pcsId || 'unknown'})`);
  await updateJob(job.id, { status: 'extracting', error: '' });

  try {
    const resp = await fetch(job.pdfUrl);
    if (!resp.ok) {
      throw new Error(`PDF fetch failed: HTTP ${resp.status}`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());

    // Wave 3.8 — infer input format from filename. DOCX takes the
    // Markdown-text branch; PDF stays on the native `document` block path.
    const mimeType = mimeFromFilename(job.pdfFilename);
    const sourceFormat = mimeType === MIME_DOCX ? 'docx' : 'pdf';

    // Preflight: cheap Haiku classifier to catch non-PCS uploads before
    // burning $0.25 on full Sonnet extraction. Fail-open on error.
    const preflightWarnings = [];
    try {
      const pf = await preflightCheckPdf(buf, job.pdfFilename || 'import', { mimeType });
      if (pf?.isPcs === false && pf.confidence > 0.8) {
        // Strong "not a PCS" signal → skip the expensive extract
        log(`[info] preflight rejected: ${job.jobId} (${pf.docType}, ${Math.round(pf.confidence * 100)}%)`);
        await updateJob(job.id, {
          status: 'skipped',
          error: `Pre-flight: not a PCS document (${pf.docType}, ${Math.round(pf.confidence * 100)}% confidence): ${pf.reason}`,
        });
        await maybeNotifyBatchComplete(job.batchId, log);
        return 'ok';
      }
      if (pf?.isPcs === false) {
        preflightWarnings.push(`[PREFLIGHT] Possibly not a PCS document (${pf.docType}, ${Math.round(pf.confidence * 100)}% confidence): ${pf.reason}`);
      }
    } catch (pfErr) {
      // Fail-open: log the warning, continue to full extract.
      preflightWarnings.push(`[PREFLIGHT] Classifier failed — proceeded anyway: ${pfErr?.message || pfErr}`);
      log(`[warn] preflight error for ${job.jobId}: ${pfErr?.message || pfErr}`);
    }

    const extracted = await extractFromPdf(buf, job.pdfFilename || 'import', { mimeType });

    const warnings = [
      ...preflightWarnings,
      ...(Array.isArray(extracted.warnings) ? extracted.warnings : []),
    ];
    await updateJob(job.id, {
      status: 'extracted',
      extractedData: JSON.stringify(extracted),
      warnings: warnings.join('\n'),
      error: '',
      promptVersion: extracted.promptVersion || '',
    });
    log(`[ok] extracted: ${job.jobId} (format=${sourceFormat})`);
    return 'ok';
  } catch (err) {
    const nextRetry = (job.retryCount || 0) + 1;
    const msg = err?.message || String(err);
    if (nextRetry >= MAX_RETRIES) {
      log(`[error] extract failed (giving up): ${job.jobId} — ${msg}`);
      await updateJob(job.id, {
        status: 'failed',
        retryCount: nextRetry,
        error: `Extraction failed after ${nextRetry} attempts: ${msg}`,
      });
      await maybeNotifyBatchComplete(job.batchId, log);
      return 'failed';
    } else {
      log(`[warn] extract failed (will retry): ${job.jobId} — ${msg}`);
      await updateJob(job.id, {
        status: 'queued',
        retryCount: nextRetry,
        error: `Extraction attempt ${nextRetry} failed: ${msg}`,
      });
      return 'retry';
    }
  }
}

/**
 * Best-effort: compute a structural diff between the existing PCS Document's
 * latest version state and the new extraction about to be committed. Any
 * failure results in a null return — never throws.
 *
 * @param {string} existingDocId
 * @param {object} newExtraction - parsed extraction JSON
 * @param {(line: string) => void} log
 * @returns {Promise<object|null>}
 */
async function computeDiffForLinkedJob(existingDocId, newExtraction, log) {
  if (!existingDocId) return null;
  try {
    const [doc, versions] = await Promise.all([
      getDocument(existingDocId),
      getVersionsForDocument(existingDocId),
    ]);
    if (!versions || versions.length === 0) {
      log(`[diff] no versions found for doc ${existingDocId}; skipping diff`);
      return null;
    }
    // Pick latest: prefer isLatest=true, else first (already sorted desc by
    // effective date in getVersionsForDocument).
    const latest = versions.find(v => v.isLatest) || versions[0];
    const [version, claims, formulaLines] = await Promise.all([
      getVersion(latest.id),
      getClaimsForVersion(latest.id),
      getFormulaLinesForVersion(latest.id),
    ]);
    const existing = {
      claims,
      formulaLines,
      document: {
        finishedGoodName: doc.finishedGoodName ?? null,
        // Extraction uses `fmt`; document stores it as `format`. Normalize to
        // the extraction shape so the diff module can compare like-for-like.
        fmt: doc.format ?? null,
        sapMaterialNo: doc.sapMaterialNo ?? null,
        skus: doc.skus ?? null,
        productName: version.productName ?? null,
        demographic: version.demographic ?? null,
        biologicalSex: version.biologicalSex ?? null,
        ageGroup:      version.ageGroup      ?? null,
        lifeStage:     version.lifeStage     ?? null,
        lifestyle:     version.lifestyle     ?? null,
      },
    };
    return computeExtractionDiff(existing, newExtraction);
  } catch (err) {
    log(`[warn] version diff failed for doc ${existingDocId}: ${err?.message || err}`);
    return null;
  }
}

/**
 * Process a single commit-phase job. Mutates status on Notion.
 *
 * @param {object} job
 * @param {(line: string) => void} log
 * @returns {Promise<'ok'|'failed'|'retry'>}
 */
async function runCommitPhase(job, log) {
  log(`[info] commit start: ${job.jobId} (${job.pcsId || 'unknown'})`);
  await updateJob(job.id, { status: 'committing', error: '' });

  try {
    if (!job.extractedData) {
      throw new Error('No extracted data stored on job — cannot commit.');
    }
    let parsed;
    try {
      parsed = JSON.parse(job.extractedData);
    } catch (parseErr) {
      throw new Error(`Failed to parse stored extractedData JSON: ${parseErr?.message || parseErr}`);
    }

    // Compute version diff BEFORE commit so we're comparing to the prior
    // state. Fully best-effort — a failure here never blocks the commit.
    let diffReport = null;
    if (job.existingDocId) {
      try {
        diffReport = await computeDiffForLinkedJob(job.existingDocId, parsed, log);
      } catch (err) {
        log(`[warn] version diff failed for ${job.jobId}: ${err?.message || err}`);
      }
    }

    const result = await commitExtraction(parsed, job.existingDocId || null);

    const counts = {
      claims: result.claimIds?.length || 0,
      formulaLines: result.formulaLineIds?.length || 0,
      references: result.referenceIds?.length || 0,
      revisionEvents: result.revisionEventIds?.length || 0,
      claimDoseReqs: result.claimDoseReqIds?.length || 0,
      evidencePackets: result.evidencePacketIds?.length || 0,
      // Template-version classification (Wave 3.7) — added 2026-04-21
      templateVersion: result.templateVersion || 'Unknown',
    };

    const prevWarnings = (job.warnings || '').split('\n').filter(Boolean);
    const newWarnings = Array.isArray(result.warnings) ? result.warnings : [];
    let sanityWarnings = [];
    try {
      sanityWarnings = runSanityChecks(parsed, result).map(w => `[SANITY] ${w}`);
      for (const sw of sanityWarnings) log(`[warn] ${sw}`);
    } catch (sanityErr) {
      log(`[warn] sanity checks threw: ${sanityErr?.message || sanityErr}`);
    }
    const mergedWarnings = [...prevWarnings, ...newWarnings, ...sanityWarnings].join('\n');

    await updateJob(job.id, {
      status: 'committed',
      createdDocumentId: result.documentId || '',
      resultCounts: JSON.stringify(counts),
      warnings: mergedWarnings,
      error: '',
      ...(diffReport ? { diffReport } : {}),
    });
    log(`[ok] committed: ${job.jobId} doc=${result.documentId}`);
    await maybeNotifyBatchComplete(job.batchId, log);
    return 'ok';
  } catch (err) {
    const nextRetry = (job.retryCount || 0) + 1;
    const msg = err?.message || String(err);
    if (nextRetry >= MAX_RETRIES) {
      log(`[error] commit failed (giving up): ${job.jobId} — ${msg}`);
      await updateJob(job.id, {
        status: 'failed',
        retryCount: nextRetry,
        error: `Commit failed after ${nextRetry} attempts: ${msg}`,
      });
      await maybeNotifyBatchComplete(job.batchId, log);
      return 'failed';
    } else {
      log(`[warn] commit failed (will retry): ${job.jobId} — ${msg}`);
      await updateJob(job.id, {
        status: 'extracted',
        retryCount: nextRetry,
        error: `Commit attempt ${nextRetry} failed: ${msg}`,
      });
      return 'retry';
    }
  }
}

/**
 * Run one cron tick: sweep stale jobs, pull up to `limit` queued jobs for
 * extraction, then up to `limit` extracted jobs for commit. Respects a
 * wall-clock deadline so the cron function returns cleanly before Vercel
 * kills it.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=3] - Max per phase this tick.
 * @param {number} [opts.deadlineMs] - Absolute epoch ms by which to return.
 * @param {(line: string) => void} [opts.log] - Logger callback.
 * @returns {Promise<{processedExtracts: number, processedCommits: number, failures: number, resets: number, timedOut: boolean}>}
 */
export async function runBatch({
  limit = 3,
  deadlineMs,
  log = () => {},
} = {}) {
  const deadline = deadlineMs ?? (Date.now() + DEFAULT_DEADLINE_MS);

  const stats = {
    processedExtracts: 0,
    processedCommits: 0,
    failures: 0,
    resets: 0,
    timedOut: false,
  };

  try {
    stats.resets = await sweepStale(log);
  } catch (err) {
    log(`[error] stale sweep failed: ${err?.message || err}`);
  }

  // Extraction phase
  const queuedJobs = await getJobsByStatus('queued', limit).catch(err => {
    log(`[error] getJobsByStatus(queued) failed: ${err?.message || err}`);
    return [];
  });

  for (const job of queuedJobs) {
    if (Date.now() + EXTRACT_BUDGET_MS > deadline) {
      log(`[info] extract budget exhausted; returning early`);
      stats.timedOut = true;
      break;
    }
    try {
      const outcome = await runExtractPhase(job, log);
      stats.processedExtracts++;
      if (outcome === 'failed') stats.failures++;
    } catch (err) {
      // Isolated: swallow so other jobs can proceed.
      log(`[error] unhandled extract error ${job.jobId}: ${err?.message || err}`);
      stats.failures++;
      try {
        await updateJob(job.id, {
          status: 'queued',
          retryCount: (job.retryCount || 0) + 1,
          error: `Unhandled error: ${err?.message || err}`,
        });
      } catch { /* best-effort */ }
    }
  }

  // Commit phase
  if (!stats.timedOut) {
    const extractedJobs = await getJobsByStatus('extracted', limit).catch(err => {
      log(`[error] getJobsByStatus(extracted) failed: ${err?.message || err}`);
      return [];
    });

    for (const job of extractedJobs) {
      if (Date.now() + COMMIT_BUDGET_MS > deadline) {
        log(`[info] commit budget exhausted; returning early`);
        stats.timedOut = true;
        break;
      }
      try {
        const outcome = await runCommitPhase(job, log);
        stats.processedCommits++;
        if (outcome === 'failed') stats.failures++;
      } catch (err) {
        log(`[error] unhandled commit error ${job.jobId}: ${err?.message || err}`);
        stats.failures++;
        try {
          await updateJob(job.id, {
            status: 'extracted',
            retryCount: (job.retryCount || 0) + 1,
            error: `Unhandled error: ${err?.message || err}`,
          });
        } catch { /* best-effort */ }
      }
    }
  }

  return stats;
}
