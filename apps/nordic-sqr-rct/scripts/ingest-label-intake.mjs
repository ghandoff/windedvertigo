#!/usr/bin/env node
/**
 * SUPERSEDED by /pcs/admin/labels/imports admin UI (Wave 5.3).
 * Kept for debugging / offline one-off runs. New operator flow should use
 * the admin UI, which drives the same Label Intake Queue + Product Labels
 * writes via the cron-powered /api/cron/process-label-imports worker.
 *
 * Ingest rows from the Notion "Label Intake Queue" DB into Product Labels
 * (Wave 5.0 — added 2026-04-21).
 *
 * Each queue row that has a label file attached AND `Ingested?` = false is
 * converted into a Product Labels row with:
 *   - SKU               → title
 *   - PCS Document      → relation (resolved via PCS ID lookup)
 *   - Label Image       → copied from the queue row's file cell
 *   - Label Version Date → today
 *   - Regulatory Framework → carried forward from the queue row
 *   - Status            → 'In Review'
 *   - Notes             → carried forward from the queue row
 *
 * After a successful create, the queue row's `Ingested?` checkbox is flipped
 * true and its `Ingested Label` relation is pointed at the new Product Labels
 * page for audit.
 *
 * Wave 5.1 (2026-04-21): Claude Vision extraction now runs per row. The
 * extracted fields (product name, UPC, claims bullet list, ingredient doses
 * JSON, regulatory framework) are written onto the Product Labels row, and
 * the full extraction JSON is embedded in Notes for human review. Confidence
 * gates: overall < 0.7 or any active ingredient dose confidence < 0.8 →
 * Status = 'Needs Reprint' (placeholder "Needs human validation" bucket until
 * a proper status lands); otherwise Status = 'In Review'.
 *
 *   node scripts/ingest-label-intake.mjs              # live
 *   node scripts/ingest-label-intake.mjs --dry-run    # preview only
 *   node scripts/ingest-label-intake.mjs --limit=5    # cap batch size
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as scripts/backfill-research-requests.mjs) ───────
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

if (!process.env.NOTION_TOKEN) {
  console.error('Missing required env: NOTION_TOKEN');
  process.exit(1);
}
if (!process.env.NOTION_PCS_PRODUCT_LABELS_DB) {
  console.error('Missing required env: NOTION_PCS_PRODUCT_LABELS_DB');
  process.exit(1);
}
if (!process.env.NOTION_PCS_LABEL_INTAKE_QUEUE_DB) {
  console.error('Missing required env: NOTION_PCS_LABEL_INTAKE_QUEUE_DB');
  process.exit(1);
}
if (envLoaded === 0) {
  console.warn(`Note: no env files loaded from ${envCandidates.join(', ')} (relying on inherited env).`);
}

// ─── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

// ─── Dynamic imports so env is populated first ──────────────────────────────
const { notion } = await import('../src/lib/notion.js');
const { PCS_DB, PROPS } = await import('../src/lib/pcs-config.js');
const { createLabel } = await import('../src/lib/pcs-labels.js');
const { getDocumentByPcsId } = await import('../src/lib/pcs-documents.js');
const {
  extractLabel,
  evaluateConfidenceGates,
  LABEL_EXTRACTION_PROMPT_VERSION,
} = await import('../src/lib/label-extraction.js');

const Q = PROPS.labelIntakeQueue;

console.log('\n=== Label Intake ingestion ===');
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} rows`);
console.log('');

// ─── Fetch queue rows ────────────────────────────────────────────────────────
const queueRows = [];
{
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.labelIntakeQueue,
      page_size: 100,
      start_cursor: cursor,
    });
    queueRows.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
}
console.log(`Fetched ${queueRows.length} Label Intake Queue rows`);

// ─── Filter: has file, not yet ingested ──────────────────────────────────────
function parseQueueRow(page) {
  const p = page.properties;
  return {
    id: page.id,
    sku: p[Q.sku]?.title?.[0]?.plain_text?.trim() || '',
    pcsId: (p[Q.pcsId]?.rich_text || []).map(t => t.plain_text).join('').trim(),
    productName: (p[Q.productName]?.rich_text || []).map(t => t.plain_text).join('').trim(),
    files: p[Q.labelFile]?.files || [],
    dateReceived: p[Q.dateReceived]?.date?.start || null,
    market: (p[Q.market]?.rich_text || []).map(t => t.plain_text).join('').trim(),
    regulatory: p[Q.regulatory]?.select?.name || null,
    ingested: p[Q.ingested]?.checkbox || false,
    notes: (p[Q.notes]?.rich_text || []).map(t => t.plain_text).join('').trim(),
  };
}

const parsed = queueRows.map(parseQueueRow);
const candidates = parsed.filter(r => !r.ingested && r.files.length > 0 && r.sku);
const skipped = parsed.length - candidates.length;
console.log(`  ${candidates.length} candidate(s) for ingestion (skipping ${skipped} already-done or empty rows)`);

const target = LIMIT ? candidates.slice(0, LIMIT) : candidates;

const today = new Date().toISOString().slice(0, 10);
const actionCounts = { created: 0, needsValidation: 0, skipped: 0, errors: 0 };
const errors = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) {
    // TODO (Wave 5.1.2): PDFs via Anthropic document block type.
    if (ct.includes('pdf')) {
      throw new Error(`label file is a PDF (${ct}); Wave 5.1 extraction supports only image/* — convert to PNG/JPEG first (PDF support tracked as Wave 5.1.2)`);
    }
  }
  const ab = await res.arrayBuffer();
  return { buf: Buffer.from(ab), contentType: ct };
}

function mediaTypeFromContentType(ct) {
  if (!ct) return null;
  const lower = ct.toLowerCase();
  if (lower.includes('png')) return 'image/png';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'image/jpeg';
  if (lower.includes('webp')) return 'image/webp';
  if (lower.includes('gif')) return 'image/gif';
  return null;
}

function summarizeExtraction(ext) {
  const ingredientCount = Array.isArray(ext.ingredients) ? ext.ingredients.length : 0;
  const claimCount = Array.isArray(ext.claims) ? ext.claims.length : 0;
  const overall = Number(ext?.confidence?.overall);
  return `ingredients=${ingredientCount}, claims=${claimCount}, overall=${Number.isFinite(overall) ? overall.toFixed(2) : '—'}`;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function buildExtractionNotes({ baseNotes, extraction, gate }) {
  const header = gate.passes
    ? `Auto-extracted ${LABEL_EXTRACTION_PROMPT_VERSION} (overall ${Number(extraction?.confidence?.overall || 0).toFixed(2)})`
    : `NEEDS HUMAN VALIDATION (${LABEL_EXTRACTION_PROMPT_VERSION}): ${gate.reasons.join('; ')}`;
  const body = JSON.stringify(extraction, null, 2);
  const combined = [baseNotes, header, '```json', body, '```'].filter(Boolean).join('\n\n');
  // Notion rich_text has a 2000-char per-block limit on single text run, but the
  // property accepts longer via chunked rich_text. Our createLabel wraps a single
  // text run, so truncate here to stay well within 2000 chars.
  return truncate(combined, 1900);
}

for (const row of target) {
  try {
    // Resolve PCS Document via PCS ID (best-effort; a missing PCS is not fatal)
    let pcsDocumentId = null;
    if (row.pcsId) {
      try {
        const doc = await getDocumentByPcsId(row.pcsId);
        pcsDocumentId = doc?.id || null;
        if (!pcsDocumentId) {
          console.warn(`  [warn] ${row.sku}: PCS ID "${row.pcsId}" not found in PCS Documents DB`);
        }
      } catch (err) {
        console.warn(`  [warn] ${row.sku}: PCS lookup failed: ${err?.message || err}`);
      }
    }

    // Copy files as external URL references where possible (Notion doesn't
    // support re-uploading file blocks across pages; external URLs survive).
    const labelImage = row.files.map(f => {
      const url = f.external?.url || f.file?.url || null;
      return url ? { name: f.name || 'label', external: { url } } : null;
    }).filter(Boolean);

    // Wave 5.1.1 — Claude Vision extraction across ALL attached panels
    // (front/back/side). We download each file and pass the set to extractLabel
    // as a single multi-image API call.
    let extraction = null;
    let gate = null;
    let extractionError = null;
    const downloadable = labelImage.filter(f => f?.external?.url);
    if (downloadable.length > 0) {
      try {
        const images = [];
        for (const f of downloadable) {
          const { buf, contentType } = await downloadImage(f.external.url);
          images.push({
            buffer: buf,
            mediaType: mediaTypeFromContentType(contentType) || undefined,
            filename: f.name || 'label',
          });
        }
        const ctx = [row.sku && `SKU ${row.sku}`, row.pcsId && `PCS ${row.pcsId}`, row.market].filter(Boolean).join(', ');
        extraction = await extractLabel(images, ctx || undefined);
        gate = evaluateConfidenceGates(extraction);
      } catch (err) {
        extractionError = err?.message || String(err);
        console.warn(`  [warn] ${row.sku}: extraction failed — ${extractionError}`);
      }
    } else {
      console.warn(`  [warn] ${row.sku}: no downloadable image URLs; skipping extraction`);
    }

    // Build payload. If extraction succeeded, merge extracted fields. Status
    // flips to 'Needs Reprint' as the placeholder "Needs human validation"
    // bucket when the gate fails (per plan §6 until a dedicated status lands).
    const extractedProductName = extraction?.productName || row.productName || undefined;
    const extractedUpc = extraction?.upc || undefined;
    const extractedClaims = Array.isArray(extraction?.claims) && extraction.claims.length
      ? extraction.claims.map(c => `• ${c.text}`).join('\n')
      : undefined;
    const extractedIngredientDoses = Array.isArray(extraction?.ingredients) && extraction.ingredients.length
      ? JSON.stringify(extraction.ingredients.map(i => ({
          name: i.name,
          dose: i.dose,
          doseUnit: i.doseUnit,
          dailyValuePercent: i.dailyValuePercent,
          isActive: i.isActive,
        })))
      : undefined;

    const gatePasses = gate ? gate.passes : false;
    const status = gatePasses ? 'In Review' : 'Needs Reprint';
    const baseNotes = [
      row.notes || '',
      extractionError ? `Extraction error: ${extractionError}` : '',
    ].filter(Boolean).join('\n\n');

    const notes = extraction
      ? buildExtractionNotes({ baseNotes, extraction, gate })
      : (baseNotes || undefined);

    const payload = {
      sku: row.sku,
      upc: extractedUpc,
      productNameAsMarketed: extractedProductName,
      labelImage,
      labelVersionDate: today,
      regulatoryFramework: extraction?.regulatoryFramework || row.regulatory || undefined,
      markets: row.market ? [row.market] : undefined,
      approvedClaimsOnLabel: extractedClaims,
      ingredientDoses: extractedIngredientDoses,
      status,
      pcsDocumentId: pcsDocumentId || undefined,
      notes,
    };

    const label = `${dryRun ? '[dry]' : '[ok]'} ${row.sku}${row.pcsId ? ` (PCS ${row.pcsId})` : ''}`;
    const extSummary = extraction ? summarizeExtraction(extraction) : (extractionError ? `extraction_failed` : 'no_image');
    const gateLabel = gate ? (gate.passes ? 'PASS' : `FAIL (${gate.reasons.length})`) : 'n/a';

    if (dryRun) {
      console.log(label);
      console.log(`       files: ${labelImage.length}, regulatory: ${payload.regulatoryFramework || '—'}, pcs match: ${pcsDocumentId ? 'yes' : 'no'}`);
      console.log(`       extraction: ${extSummary} | gate: ${gateLabel} | status-would-be: ${status}`);
      if (gate && !gate.passes) {
        for (const r of gate.reasons) console.log(`         - ${r}`);
      }
      actionCounts.created += 1;
      if (gate && !gate.passes) actionCounts.needsValidation += 1;
      continue;
    }

    const created = await createLabel(payload);

    // Flip the queue row to Ingested + link
    await notion.pages.update({
      page_id: row.id,
      properties: {
        [Q.ingested]: { checkbox: true },
        [Q.ingestedLabel]: { relation: [{ id: created.id }] },
      },
    });

    actionCounts.created += 1;
    if (gate && !gate.passes) actionCounts.needsValidation += 1;
    console.log(`${label} → created ${created.id} | extraction: ${extSummary} | gate: ${gateLabel} | status: ${status}`);
  } catch (err) {
    console.error(`[fail] ${row.sku}: ${err?.message || err}`);
    errors.push({ sku: row.sku, error: err?.message || String(err) });
    actionCounts.errors += 1;
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({
  dryRun,
  queueTotal: queueRows.length,
  candidates: candidates.length,
  processed: target.length,
  actionCounts,
  errorCount: errors.length,
}, null, 2));

if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) console.log(`  ${e.sku}: ${e.error}`);
  process.exit(1);
}
