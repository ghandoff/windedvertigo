/**
 * Label Import worker — state machine that advances Pending → Committed.
 *
 * Runs under Vercel Cron (`/api/cron/process-label-imports`) every 5 minutes
 * with a 13-minute wall-clock budget. Each row is isolated so one bad image
 * doesn't kill the whole batch. Retry caps at MAX_RETRIES per phase before
 * the row transitions to Failed.
 *
 * Pattern mirrors src/lib/pcs-import-runner.js. See docs/plans/wave-5-product-labels.md §6.
 *
 * Added 2026-04-21 as part of Wave 5.3.
 */

import {
  getIntakeRowsByStatus,
  getStaleIntakeRows,
  updateIntakeRow,
} from './label-intake-queue.js';
import { extractLabel, evaluateConfidenceGates, LABEL_EXTRACTION_PROMPT_VERSION } from './label-extraction.js';
import { createLabel } from './pcs-labels.js';
import { getDocumentByPcsId } from './pcs-documents.js';

const STALE_THRESHOLD_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;
const DEFAULT_DEADLINE_MS = 780_000; // 13 min
const EXTRACT_BUDGET_MS = 3 * 60 * 1000; // label extraction is faster than PCS

/** Reset stale `Extracting` rows back to `Pending`. */
async function sweepStale(log) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  const stale = await getStaleIntakeRows('Extracting', cutoff, 10);
  let resets = 0;
  for (const row of stale) {
    log(`[warn] stale label intake row ${row.sku || row.id} — resetting to Pending`);
    await updateIntakeRow(row.id, {
      status: 'Pending',
      retryCount: (row.retryCount || 0) + 1,
      error: `Reset from stale 'Extracting' state at ${new Date().toISOString()}`,
    });
    resets++;
  }
  return resets;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText}`);
  const ct = res.headers.get('content-type') || '';
  const ab = await res.arrayBuffer();
  return { buf: Buffer.from(ab), contentType: ct };
}

function mediaTypeFromContentType(ct, _filename) {
  if (!ct) return null;
  const lower = ct.toLowerCase();
  if (lower.includes('pdf')) return 'application/pdf';
  if (lower.includes('png')) return 'image/png';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'image/jpeg';
  if (lower.includes('webp')) return 'image/webp';
  if (lower.includes('gif')) return 'image/gif';
  // Fall back to filename-based inference (handled inside extractLabel).
  return null;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '\u2026' : str;
}

function buildExtractionNotes({ baseNotes, extraction, gate }) {
  const header = gate.passes
    ? `Auto-extracted ${LABEL_EXTRACTION_PROMPT_VERSION} (overall ${Number(extraction?.confidence?.overall || 0).toFixed(2)})`
    : `NEEDS HUMAN VALIDATION (${LABEL_EXTRACTION_PROMPT_VERSION}): ${gate.reasons.join('; ')}`;
  const body = JSON.stringify(extraction, null, 2);
  const combined = [baseNotes, header, '```json', body, '```'].filter(Boolean).join('\n\n');
  return truncate(combined, 1900);
}

/**
 * Advance one Pending row through extract → commit.
 */
async function processRow(row, log) {
  // Wave 5.3.1: no pre-extraction SKU/PCS gate. Extraction is the source of
  // truth for SKU on the label image; the operator only needs to confirm PCS
  // linkage after extraction completes (at the Needs Validation step).
  log(`[extract] ${row.id} starting extraction (SKU=${row.sku ?? 'will auto-fill'}, PCS=${row.pcsId ?? 'will require operator'})`);

  await updateIntakeRow(row.id, { status: 'Extracting', error: '' });

  try {
    // Wave 5.1.1: iterate ALL attached files (multi-panel labels: front/back/side).
    // Notion's `files` property returns an array — we download each and pass the
    // entire set to Claude Vision in a single API call.
    const allFiles = (row.files || []).filter(f => f?.url);
    if (allFiles.length === 0) {
      throw new Error('no downloadable image URL on any file');
    }
    const downloaded = [];
    for (const f of allFiles) {
      const { buf, contentType } = await downloadImage(f.url);
      downloaded.push({
        buffer: buf,
        mediaType: mediaTypeFromContentType(contentType, f.name) || undefined,
        filename: f.name || 'label',
      });
    }
    log(`[info] ${row.sku}: extracting ${downloaded.length} panel${downloaded.length === 1 ? '' : 's'}`);
    const extractionContext = [row.sku && `SKU ${row.sku}`, row.pcsId && `PCS ${row.pcsId}`, row.market].filter(Boolean).join(', ');
    const extraction = await extractLabel(downloaded, extractionContext || undefined);
    const gate = evaluateConfidenceGates(extraction);

    // Wave 5.3.1: self-heal SKU. If the operator never filled one (or left the
    // auto-generated `LABEL-<batch>-<rand>` placeholder) and the extractor read
    // a SKU off the label, persist it back to the intake row's title.
    const isPlaceholderSku = !row.sku || /^LABEL-/i.test(row.sku);
    const extractedSku = typeof extraction?.sku === 'string' ? extraction.sku.trim() : '';
    const effectiveSku = isPlaceholderSku && extractedSku ? extractedSku : row.sku;
    if (isPlaceholderSku && extractedSku && extractedSku !== row.sku) {
      log(`[extract] ${row.id} auto-filled SKU ${extractedSku} (was ${row.sku || 'empty'})`);
    }

    // Resolve PCS Document via PCS ID (best-effort; missing is not fatal).
    // Wave 5.3.1: pcsId may be absent — in that case we don't look up and
    // the row will land as Needs Validation for operator follow-up.
    let pcsDocumentId = null;
    if (row.pcsId) {
      try {
        const doc = await getDocumentByPcsId(row.pcsId);
        pcsDocumentId = doc?.id || null;
      } catch (err) {
        log(`[warn] PCS lookup failed for ${row.pcsId}: ${err?.message || err}`);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const labelImage = (row.files || [])
      .map(f => (f.url ? { name: f.name || 'label', external: { url: f.url } } : null))
      .filter(Boolean);

    const extractedClaims = Array.isArray(extraction?.claims) && extraction.claims.length
      ? extraction.claims.map(c => `\u2022 ${c.text}`).join('\n')
      : undefined;
    // Notion rich_text has a hard 2000-char limit per chunk. Multivitamin labels
    // (e.g. MensMultiGummies has ~30 ingredients) can blow past that. Truncate
    // with a marker so the full payload stays in the extractionData field on
    // the intake row, while the Product Label row gets a display-ready slice.
    const extractedIngredientDoses = Array.isArray(extraction?.ingredients) && extraction.ingredients.length
      ? truncate(
          JSON.stringify(extraction.ingredients.map(i => ({
            name: i.name,
            dose: i.dose,
            doseUnit: i.doseUnit,
            dailyValuePercent: i.dailyValuePercent,
            isActive: i.isActive,
          }))),
          1950,
        )
      : undefined;

    // Wave 5.3.1: gate moves to commit time.
    //   - gate passes AND pcsId present → Product Label Status = 'In Review',
    //     Intake Queue Status = 'Committed'.
    //   - gate passes but pcsId missing → Product Label Status = 'Needs Validation'
    //     (extractor data captured, but not linked to a PCS yet), Intake Queue
    //     Status = 'Needs Validation' so the operator adds PCS ID + re-commits.
    //   - gate fails (regardless of pcsId) → Product Label Status = 'Needs Validation',
    //     Intake Queue Status = 'Needs Validation' as before.
    const hasPcs = Boolean(row.pcsId);
    const fullyReady = gate.passes && hasPcs;
    const labelStatus = fullyReady ? 'In Review' : 'Needs Validation';
    const baseNotes = row.notes || '';
    const notes = buildExtractionNotes({ baseNotes, extraction, gate });

    const payload = {
      sku: effectiveSku,
      upc: extraction?.upc || undefined,
      productNameAsMarketed: extraction?.productName || row.productName || undefined,
      labelImage,
      labelVersionDate: today,
      regulatoryFramework: extraction?.regulatoryFramework || row.regulatory || undefined,
      markets: row.market ? [row.market] : undefined,
      approvedClaimsOnLabel: extractedClaims,
      ingredientDoses: extractedIngredientDoses,
      status: labelStatus,
      pcsDocumentId: pcsDocumentId || undefined,
      notes,
    };

    const created = await createLabel(payload);

    const gateReasons = gate.passes
      ? (hasPcs ? '' : 'Missing PCS ID — operator must link this label to a PCS before it can go Active.')
      : gate.reasons.join('; ');

    await updateIntakeRow(row.id, {
      status: fullyReady ? 'Committed' : 'Needs Validation',
      ingested: fullyReady,
      ingestedLabelId: created.id,
      extractionData: JSON.stringify(extraction),
      promptVersion: extraction.promptVersion || LABEL_EXTRACTION_PROMPT_VERSION,
      confidenceOverall: Number(extraction?.confidence?.overall ?? 0),
      error: gateReasons,
      // Self-heal the SKU on the intake row if the extractor found one and the
      // prior value was a LABEL- placeholder.
      ...(isPlaceholderSku && extractedSku ? { sku: extractedSku } : {}),
    });

    const outcomeLabel = fullyReady
      ? 'committed'
      : (gate.passes ? 'needs-validation (no PCS)' : 'needs-validation');
    log(`[ok] ${outcomeLabel}: ${effectiveSku || row.id} \u2192 label ${created.id}`);
    return 'ok';
  } catch (err) {
    const nextRetry = (row.retryCount || 0) + 1;
    const msg = err?.message || String(err);
    if (nextRetry >= MAX_RETRIES) {
      log(`[error] extract failed (giving up): ${row.sku || row.id} \u2014 ${msg}`);
      await updateIntakeRow(row.id, {
        status: 'Failed',
        retryCount: nextRetry,
        error: `Extraction failed after ${nextRetry} attempts: ${msg}`,
      });
      return 'failed';
    }
    log(`[warn] extract failed (will retry): ${row.sku || row.id} \u2014 ${msg}`);
    await updateIntakeRow(row.id, {
      status: 'Pending',
      retryCount: nextRetry,
      error: `Extraction attempt ${nextRetry} failed: ${msg}`,
    });
    return 'retry';
  }
}

/**
 * One cron tick.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=3]
 * @param {number} [opts.deadlineMs]
 * @param {(line: string) => void} [opts.log]
 */
export async function runLabelBatch({
  limit = 3,
  deadlineMs,
  log = () => {},
} = {}) {
  const deadline = deadlineMs ?? (Date.now() + DEFAULT_DEADLINE_MS);
  const stats = { processed: 0, committed: 0, needsValidation: 0, failed: 0, skipped: 0, resets: 0, timedOut: false };

  try {
    stats.resets = await sweepStale(log);
  } catch (err) {
    log(`[error] stale sweep failed: ${err?.message || err}`);
  }

  const pending = await getIntakeRowsByStatus('Pending', limit).catch(err => {
    log(`[error] getIntakeRowsByStatus(Pending) failed: ${err?.message || err}`);
    return [];
  });

  for (const row of pending) {
    if (Date.now() + EXTRACT_BUDGET_MS > deadline) {
      log('[info] budget exhausted; returning early');
      stats.timedOut = true;
      break;
    }
    try {
      const outcome = await processRow(row, log);
      stats.processed++;
      if (outcome === 'ok') stats.committed++;
      else if (outcome === 'failed') stats.failed++;
      else if (outcome === 'skip') stats.skipped++;
    } catch (err) {
      log(`[error] unhandled error on ${row.sku || row.id}: ${err?.message || err}`);
      stats.failed++;
      try {
        await updateIntakeRow(row.id, {
          status: 'Pending',
          retryCount: (row.retryCount || 0) + 1,
          error: `Unhandled error: ${err?.message || err}`,
        });
      } catch { /* best-effort */ }
    }
  }

  return stats;
}
