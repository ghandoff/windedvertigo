import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  createJob,
  parsePcsIdFromFilename,
  getJobByContentHash,
} from '@/lib/pcs-import-jobs';
import { getDocumentByPcsId } from '@/lib/pcs-documents';
// NOTE: preflightCheckPdf was moved to the worker (pcs-import-runner.js) as
// of 2026-04-21 after 504 timeouts at stage time for 4-PDF batches. Stage
// now only does blob upload + Notion dedup + createJob. The worker runs
// preflight on the 'extracting' transition, before the full Sonnet extract.
import { getJobsByBatch, updateJob } from '@/lib/pcs-import-jobs';
import { notifyBatchComplete } from '@/lib/slack-notifier';

/**
 * DEPRECATED 2026-04-21: superseded by direct-to-blob client uploads via
 * /api/admin/imports/upload-token + /api/admin/imports/register. Kept in
 * place for one release cycle in case we need to fall back. Remove in
 * Wave 4 if no issues surface.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Claude Sonnet 4.5 cost model (as of 2026-04-19).
// Rough per-page input token estimate for a Nordic PCS PDF; output is fairly
// constant regardless of page count since the schema is fixed-size.
const INPUT_TOKENS_PER_PAGE = 1800;
const OUTPUT_TOKENS_PER_PDF = 5000;
const INPUT_PRICE_PER_MTOK = 3.0;
const OUTPUT_PRICE_PER_MTOK = 15.0;

// Wave 3.8 — DOCX accepted alongside PDF.
const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ALLOWED_MIMES = new Set([MIME_PDF, MIME_DOCX]);
const WORDS_PER_VIRTUAL_PAGE = 180;

/**
 * Compute estimated Claude extraction cost for a PDF of the given page count.
 *
 * @param {number} pageCount
 * @returns {number} USD cost.
 */
function estimateCost(pageCount) {
  const inputCost = (pageCount * INPUT_TOKENS_PER_PAGE / 1_000_000) * INPUT_PRICE_PER_MTOK;
  const outputCost = (OUTPUT_TOKENS_PER_PDF / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
  return inputCost + outputCost;
}

function fmtUSD(n) {
  return `$${n.toFixed(2)}`;
}

/**
 * POST /api/admin/imports/stage
 *
 * Multipart upload of N PCS PDFs. Each file is:
 *   1. Hashed (sha256) for content-dedup against prior committed/extracted jobs.
 *   2. Page-counted (pdf-lib) so we can estimate Claude extraction cost.
 *   3. Uploaded to Vercel Blob.
 *   4. Checked against existing PCS documents for PCS-ID-level conflict.
 *   5. Written as a job row in PCS Import Jobs (status=queued|skipped).
 *
 * Dedup outcomes:
 *   - Content-hash match against a prior committed job → initialStatus='skipped',
 *     error describes the prior job so the operator can audit.
 *   - PCS-ID match + conflictAction='skip' → initialStatus='skipped'.
 *   - PCS-ID match + conflictAction='link' → status='queued', existingDocId populated.
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports/stage' });
  if (auth.error) return auth.error;
  const user = auth.user;

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid multipart body', message: err?.message || String(err) },
      { status: 400 },
    );
  }

  const files = formData.getAll('files[]').filter(f => f && typeof f === 'object' && 'arrayBuffer' in f);
  const conflictAction = (formData.get('conflictAction') || 'skip').toString();
  if (!['skip', 'link'].includes(conflictAction)) {
    return NextResponse.json(
      { error: 'Invalid conflictAction (expected skip or link)' },
      { status: 400 },
    );
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured (BLOB_READ_WRITE_TOKEN missing)' },
      { status: 500 },
    );
  }

  const batchId = `B${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const jobs = [];
  const counts = { queued: 0, skipped: 0, errored: 0 };
  let totalPages = 0;
  let totalCost = 0;
  let savedCost = 0; // from content-hash skips
  let costedPdfs = 0;

  // Process files concurrently. Blob upload is pure I/O; the Notion calls
  // per file are also independent. Concurrency is bounded by the number of
  // uploaded files (usually <= 20 per batch) so no rate-limit risk.
  const processFile = async (file) => {
    const filename = file.name || 'pcs-upload.pdf';
    try {
      if (file.type && !ALLOWED_MIMES.has(file.type)) {
        counts.errored++;
        jobs.push({ filename, error: 'Not a PDF or Word .docx' });
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        counts.errored++;
        jobs.push({ filename, error: 'File exceeds 20 MB' });
        return;
      }

      // Read the buffer ONCE and reuse for hash, page count, and upload.
      const buffer = Buffer.from(await file.arrayBuffer());
      const contentHash = createHash('sha256').update(buffer).digest('hex');

      // Wave 3.8 — branch on MIME/extension for DOCX inputs. DOCX gets a
      // mammoth-based word count → virtual page estimate; PDF stays on pdf-lib.
      const isDocx = file.type === MIME_DOCX || /\.docx$/i.test(filename);
      let pageCount = 0;
      let sourceFormat = isDocx ? 'docx' : 'pdf';
      let docxError = null;
      if (isDocx) {
        try {
          const { convertDocxToMarkdown } = await import('@/lib/docx-to-markdown');
          const conv = await convertDocxToMarkdown(buffer);
          pageCount = Math.max(1, Math.ceil(conv.wordCount / WORDS_PER_VIRTUAL_PAGE));
        } catch (dxErr) {
          docxError = { code: dxErr?.code || 'DOCX_CONVERT_FAILED', message: dxErr?.message || String(dxErr) };
          console.warn(`DOCX convert failed for ${filename}:`, docxError.message);
        }
      } else {
        try {
          const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
          pageCount = pdf.getPageCount();
        } catch (pdfErr) {
          // Non-fatal: keep pageCount=0 and flag via warning-ish jobs entry.
          console.warn(`pdf-lib page-count failed for ${filename}:`, pdfErr?.message || pdfErr);
        }
      }
      const cost = estimateCost(pageCount);

      // Content-hash dedup — short-circuits upload/extract/commit entirely
      // when we've already done this exact PDF.
      let contentDupMatch = null;
      try {
        contentDupMatch = await getJobByContentHash(contentHash);
      } catch (dupErr) {
        console.warn('Content-hash dedup query failed:', dupErr?.message || dupErr);
      }

      const blob = await put(`pcs-imports/${filename}`, buffer, {
        access: 'public',
        addRandomSuffix: true,
        contentType: isDocx ? MIME_DOCX : MIME_PDF,
      });

      const pcsId = parsePcsIdFromFilename(filename);
      let existingDocId = null;
      if (pcsId) {
        try {
          const doc = await getDocumentByPcsId(pcsId);
          if (doc) existingDocId = doc.id;
        } catch (lookupErr) {
          // Non-fatal: proceed without dedup info.
          console.warn('Dedup lookup failed:', lookupErr?.message || lookupErr);
        }
      }

      let initialStatus = 'queued';
      let stageError = null;
      if (docxError) {
        initialStatus = 'failed';
        const friendly = {
          DOCX_LEGACY_FORMAT: "Legacy .doc files aren't supported — save as .docx and re-upload",
          DOCX_PASSWORD_PROTECTED: 'Password-protected — remove the password and re-upload',
          DOCX_CORRUPT: 'File corrupt or unsupported — re-save the document in Word and re-upload',
        }[docxError.code] || `DOCX parse failed: ${docxError.message}`;
        stageError = friendly;
      } else if (contentDupMatch) {
        initialStatus = 'skipped';
        stageError = `identical content previously imported (job: ${contentDupMatch.jobId}, batch: ${contentDupMatch.batchId})`;
      } else if (existingDocId && conflictAction === 'skip') {
        initialStatus = 'skipped';
      }
      // For 'link', we still go through 'queued' → extract → commit, but the
      // commit phase picks up existingDocId and updates the existing doc
      // instead of creating a new one.

      // Preflight moved to worker (runs during 'extracting' transition).
      // See src/lib/pcs-import-runner.js.
      const preflightResult = null;
      const preflightWarning = null;

      const created = await createJob({
        pdfUrl: blob.url,
        pdfFilename: filename,
        pcsId,
        conflictAction,
        existingDocId,
        batchId,
        ownerEmail: user.email || null,
        initialStatus,
        contentHash,
        error: stageError,
        warnings: preflightWarning || null,
      });

      if (initialStatus === 'skipped') counts.skipped++;
      else if (initialStatus === 'failed') counts.errored++;
      else counts.queued++;

      // Cost aggregation: only count pdfs we'll actually extract.
      if (pageCount > 0) costedPdfs++;
      if (initialStatus === 'queued') {
        totalPages += pageCount;
        totalCost += cost;
      } else if (contentDupMatch) {
        savedCost += cost;
      }

      jobs.push({
        id: created.id,
        jobId: created.jobId,
        pcsId: created.pcsId,
        filename,
        status: created.status,
        existingDocId: created.existingDocId || null,
        contentHash,
        pageCount,
        sourceFormat, // Wave 3.8 — 'pdf' | 'docx'
        docxErrorCode: docxError?.code || undefined,
        estimatedCost: fmtUSD(cost),
        dedup: contentDupMatch
          ? { type: 'content-hash', priorJobId: contentDupMatch.jobId, priorBatchId: contentDupMatch.batchId }
          : null,
        preflight: preflightResult
          ? {
              isPcs: preflightResult.isPcs,
              confidence: preflightResult.confidence,
              docType: preflightResult.docType,
              reason: preflightResult.reason,
              warning: preflightWarning,
            }
          : null,
      });
    } catch (err) {
      counts.errored++;
      jobs.push({ filename, error: err?.message || String(err) });
      console.error(`Stage failed for ${filename}:`, err);
    }
  };

  // Dispatch all files concurrently. Mutations to the outer counts/jobs
  // arrays are safe in Node's single-threaded event loop — each async
  // callback runs to completion between its awaits, so there's no true
  // race. This turns N × ~3-5s serial (Blob upload + Notion dedup +
  // createJob) into parallel.
  await Promise.all(files.map(f => processFile(f)));

  // If the entire batch was staged in a terminal state (all skipped/errored),
  // fire the Slack notifier now since the worker won't run for this batch.
  try {
    const peers = await getJobsByBatch(batchId);
    const terminal = ['committed', 'failed', 'skipped'];
    const allTerminal = peers.length > 0 && peers.every(j => terminal.includes(j.status));
    if (allTerminal && !peers.some(j => j.notificationSent)) {
      const stats = {
        committed: peers.filter(j => j.status === 'committed').length,
        failed: peers.filter(j => j.status === 'failed').length,
        skipped: peers.filter(j => j.status === 'skipped').length,
        total: peers.length,
      };
      const warnSet = new Set();
      for (const j of peers) {
        if (j.warnings) {
          for (const w of j.warnings.split('\n')) {
            const trimmed = w.trim();
            if (trimmed) warnSet.add(trimmed);
          }
        }
      }
      const { sent } = await notifyBatchComplete({
        batchId,
        stats,
        sanityWarnings: Array.from(warnSet),
      });
      if (sent) {
        for (const j of peers) {
          try { await updateJob(j.id, { notificationSent: true }); } catch { /* best-effort */ }
        }
      }
    }
  } catch (err) {
    console.warn('Stage-time batch notify check failed:', err?.message || err);
  }

  return NextResponse.json({
    batchId,
    jobs,
    counts,
    pageCount: totalPages,
    estimatedCost: {
      total: fmtUSD(totalCost),
      perPdfAvg: fmtUSD(costedPdfs > 0 ? totalCost / Math.max(1, counts.queued) : 0),
      savedFromDedup: fmtUSD(savedCost),
    },
  });
}
