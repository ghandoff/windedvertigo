import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  createJob,
  parsePcsIdFromFilename,
  getJobByContentHash,
  getJobsByBatch,
  updateJob,
} from '@/lib/pcs-import-jobs';
import { getDocumentByPcsId } from '@/lib/pcs-documents';
import { notifyBatchComplete } from '@/lib/slack-notifier';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Keep in sync with stage/route.js — same Claude Sonnet 4.5 model (2026-04-19).
const INPUT_TOKENS_PER_PAGE = 1800;
const OUTPUT_TOKENS_PER_PDF = 5000;
const INPUT_PRICE_PER_MTOK = 3.0;
const OUTPUT_PRICE_PER_MTOK = 15.0;

// Wave 3.8 — DOCX cost-estimate heuristic. Typeset prose at standard
// letter-size, 1.15 line-spacing, 11pt runs ~180 words per page. We translate
// mammoth's word count into a "virtual page count" and reuse the same Sonnet
// pricing as PDFs so the operator sees comparable $ estimates in the UI.
const WORDS_PER_VIRTUAL_PAGE = 180;

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Compute estimated Claude extraction cost for a document of the given page
 * count (or virtual page count for DOCX).
 *
 * @param {number} pageCount
 * @returns {number} USD cost.
 */
function estimateCost(pageCount) {
  const inputCost = (pageCount * INPUT_TOKENS_PER_PAGE / 1_000_000) * INPUT_PRICE_PER_MTOK;
  const outputCost = (OUTPUT_TOKENS_PER_PDF / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
  return inputCost + outputCost;
}

/**
 * Sniff the format of an uploaded buffer. Filename extension is the primary
 * signal; MIME magic bytes are a fallback to catch misnamed uploads.
 */
function detectFormat({ filename, buffer }) {
  if (filename && /\.docx$/i.test(filename)) return 'docx';
  if (filename && /\.pdf$/i.test(filename)) return 'pdf';
  if (buffer && buffer.length >= 4) {
    // %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'pdf';
    // PK\x03\x04 → zip (docx is a zip)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) return 'docx';
  }
  return 'pdf';
}

function fmtUSD(n) {
  return `$${n.toFixed(2)}`;
}

/**
 * POST /api/admin/imports/register
 *
 * Wave 3 counterpart to the legacy stage endpoint. The browser has already
 * uploaded each PDF directly to Vercel Blob (via /api/admin/imports/upload-token);
 * this route takes the resulting URLs + metadata and does everything the
 * old stage route did AFTER the upload:
 *   1. Fetch the blob briefly to page-count + verify it's readable
 *   2. Content-hash dedup via Notion Import Jobs
 *   3. PCS-ID dedup via Notion Documents
 *   4. Create a Notion import-job row (queued|skipped)
 *   5. Fire Slack notifier if the whole batch staged terminal
 *
 * Body:
 *   {
 *     uploads: [{ url, filename, size, contentHash }, ...],
 *     conflictAction: 'skip' | 'link'
 *   }
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports/register' });
  if (auth.error) return auth.error;
  const user = auth.user;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid JSON body', message: err?.message || String(err) },
      { status: 400 },
    );
  }

  const uploads = Array.isArray(body?.uploads) ? body.uploads : [];
  const conflictAction = (body?.conflictAction || 'skip').toString();
  if (!['skip', 'link'].includes(conflictAction)) {
    return NextResponse.json(
      { error: 'Invalid conflictAction (expected skip or link)' },
      { status: 400 },
    );
  }
  if (uploads.length === 0) {
    return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
  }
  for (const [i, u] of uploads.entries()) {
    if (!u || typeof u !== 'object') {
      return NextResponse.json({ error: `uploads[${i}] is not an object` }, { status: 400 });
    }
    if (typeof u.url !== 'string' || !u.url) {
      return NextResponse.json({ error: `uploads[${i}].url missing` }, { status: 400 });
    }
    if (typeof u.filename !== 'string' || !u.filename) {
      return NextResponse.json({ error: `uploads[${i}].filename missing` }, { status: 400 });
    }
    if (typeof u.contentHash !== 'string' || !u.contentHash) {
      return NextResponse.json({ error: `uploads[${i}].contentHash missing` }, { status: 400 });
    }
    if (typeof u.size !== 'number') {
      return NextResponse.json({ error: `uploads[${i}].size missing` }, { status: 400 });
    }
  }

  const batchId = `B${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const jobs = [];
  const counts = { queued: 0, skipped: 0, errored: 0 };
  let totalPages = 0;
  let totalCost = 0;
  let savedCost = 0;
  let costedPdfs = 0;

  const processUpload = async (upload) => {
    const { url, filename, contentHash, size } = upload;
    try {
      // Brief fetch so we can page-count (PDFs) or word-count (DOCX). Blob
      // is already uploaded — this is a quick GET back from the edge,
      // usually <500ms even for 20 MB.
      let pageCount = 0;
      let sourceFormat = 'pdf';
      let docxStats = null;
      let docxError = null;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Blob fetch HTTP ${resp.status}`);
        const buffer = Buffer.from(await resp.arrayBuffer());
        sourceFormat = detectFormat({ filename, buffer });
        if (sourceFormat === 'docx') {
          // Wave 3.8 — DOCX path: mammoth-convert to Markdown, estimate a
          // "virtual page count" from the word count so the Sonnet cost math
          // stays comparable to the PDF branch.
          try {
            const { convertDocxToMarkdown } = await import('@/lib/docx-to-markdown');
            const conv = await convertDocxToMarkdown(buffer);
            pageCount = Math.max(1, Math.ceil(conv.wordCount / WORDS_PER_VIRTUAL_PAGE));
            docxStats = {
              tables: conv.tables,
              images: conv.images,
              wordCount: conv.wordCount,
              warnings: conv.warnings.length,
            };
          } catch (dxErr) {
            docxError = {
              code: dxErr?.code || 'DOCX_CONVERT_FAILED',
              message: dxErr?.message || String(dxErr),
            };
            console.warn(`DOCX convert failed for ${filename}:`, docxError.message);
          }
        } else {
          try {
            const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
            pageCount = pdf.getPageCount();
          } catch (pdfErr) {
            console.warn(`pdf-lib page-count failed for ${filename}:`, pdfErr?.message || pdfErr);
          }
        }
      } catch (fetchErr) {
        // Non-fatal: we can still register the job without a page count.
        console.warn(`Blob readback failed for ${filename}:`, fetchErr?.message || fetchErr);
      }
      const cost = estimateCost(pageCount);

      let contentDupMatch = null;
      try {
        contentDupMatch = await getJobByContentHash(contentHash);
      } catch (dupErr) {
        console.warn('Content-hash dedup query failed:', dupErr?.message || dupErr);
      }

      const pcsId = parsePcsIdFromFilename(filename);
      let existingDocId = null;
      if (pcsId) {
        try {
          const doc = await getDocumentByPcsId(pcsId);
          if (doc) existingDocId = doc.id;
        } catch (lookupErr) {
          console.warn('Dedup lookup failed:', lookupErr?.message || lookupErr);
        }
      }

      let initialStatus = 'queued';
      let stageError = null;
      if (docxError) {
        // Wave 3.8 — a DOCX that couldn't be parsed has no shot at extraction.
        // Surface the taxonomy code so the UI can render an actionable error
        // (legacy .doc → save as .docx; password-protected → remove password;
        // corrupt → re-save in Word).
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

      const created = await createJob({
        pdfUrl: url,
        pdfFilename: filename,
        pcsId,
        conflictAction,
        existingDocId,
        batchId,
        ownerEmail: user.email || null,
        initialStatus,
        contentHash,
        error: stageError,
        warnings: null,
      });

      if (initialStatus === 'skipped') counts.skipped++;
      else if (initialStatus === 'failed') counts.errored++;
      else counts.queued++;

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
        size,
        sourceFormat,                               // Wave 3.8 — 'pdf' | 'docx'
        docxStats,                                  // Wave 3.8 — tables/images/wordCount for DOCX
        error: docxError ? stageError : undefined,  // Wave 3.8 — surface friendly DOCX failure
        docxErrorCode: docxError?.code || undefined,
        estimatedCost: fmtUSD(cost),
        dedup: contentDupMatch
          ? { type: 'content-hash', priorJobId: contentDupMatch.jobId, priorBatchId: contentDupMatch.batchId }
          : null,
        preflight: null,
      });
    } catch (err) {
      counts.errored++;
      jobs.push({ filename, error: err?.message || String(err) });
      console.error(`Register failed for ${filename}:`, err);
    }
  };

  // Same single-threaded safety as stage/route.js — mutations to shared
  // counts/jobs between awaits are race-free in Node's event loop.
  await Promise.all(uploads.map(u => processUpload(u)));

  // Terminal-batch Slack notify — copied verbatim from stage/route.js so a
  // batch of all-skipped registers still pings #pcs-imports.
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
    console.warn('Register-time batch notify check failed:', err?.message || err);
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
