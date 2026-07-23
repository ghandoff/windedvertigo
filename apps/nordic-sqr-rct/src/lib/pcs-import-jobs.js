/**
 * PCS Import Jobs CRUD — durable job queue for batch PCS PDF import.
 *
 * Jobs flow through these states:
 *   queued → extracting → extracted → committing → committed
 *   (or: skipped, failed)
 *
 * The full extraction JSON is chunked into multiple rich_text runs on
 * `Extracted data` (each ≤ 2000 chars, up to 100 runs per property).
 *
 * Added 2026-04-19 as part of the batch-import feature (v1).
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';


const P = PROPS.importJobs;

// ── Postgres path (2026-07 — full rich-field migration off Notion) ───────────
// The pcs_import_jobs table now stores every job field (the 2026-07 migration
// added job_id/pdf_url/batch_id/content_hash/extracted_data/… + updated_at +
// the trg_set_updated_at trigger). Rich fields snake_case mechanically via
// notionShapeToPgRow, so the map only overrides the non-mechanical names.
const IMPORT_JOBS_PG_COLUMN_MAP = {
  pcsId: 'pcs_id',
  error: 'error_log',
  createdTime: 'notion_created_at',
  lastEditedTime: 'notion_last_edited_at',
};

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    jobId: row.job_id || '',
    status: row.status || null,
    pdfUrl: row.pdf_url || null,
    pdfFilename: row.pdf_filename || '',
    pcsId: row.pcs_id || '',
    existingDocId: row.existing_doc_id || '',
    conflictAction: row.conflict_action || null,
    extractedData: row.extracted_data || '',
    createdDocumentId: row.created_document_id || '',
    resultCounts: row.result_counts || '',
    warnings: row.warnings || '',
    error: row.error_log || '',
    retryCount: row.retry_count ?? 0,
    batchId: row.batch_id || '',
    ownerEmail: row.owner_email || null,
    contentHash: row.content_hash || '',
    promptVersion: row.prompt_version || '',
    notificationSent: row.notification_sent ?? false,
    diffReport: (() => {
      if (!row.diff_report) return null;
      try { return JSON.parse(row.diff_report); } catch { return null; }
    })(),
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

// Notion rich_text limits: each text run caps at 2000 chars, a property
// accepts up to 100 runs. We use a conservative 1800-char chunk to leave
// margin for JSON escaping boundaries.
const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 100;

/**
 * Split a long string into fixed-size chunks suitable for Notion rich_text runs.
 *
 * @param {string} str - Full string (may be empty).
 * @returns {string[]} Ordered chunks. Empty input returns [].
 */
function chunkString(str) {
  if (!str) return [];
  const chunks = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) {
    chunks.push(str.slice(i, i + CHUNK_SIZE));
    if (chunks.length >= MAX_CHUNKS) break;
  }
  return chunks;
}

/**
 * Build a Notion rich_text array from a long string by chunking.
 *
 * @param {string} str - Full string.
 * @returns {Array} rich_text payload.
 */
function toRichText(str) {
  const chunks = chunkString(str || '');
  if (chunks.length === 0) return [];
  return chunks.map(c => ({ text: { content: c } }));
}

/**
 * Reassemble a rich_text array back into the original string.
 *
 * @param {Array} richText - Notion rich_text property value.
 * @returns {string} Concatenated plain text.
 */
function fromRichText(richText) {
  return (richText || []).map(t => t.plain_text || t.text?.content || '').join('');
}

/**
 * Map a Notion page into a plain job object.
 *
 * @param {object} page - Notion page as returned by the API.
 * @returns {object} Parsed job with all fields decoded.
 */
export function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    jobId: p[P.jobId]?.title?.[0]?.plain_text || '',
    status: p[P.status]?.select?.name || null,
    pdfUrl: p[P.pdfUrl]?.url || null,
    pdfFilename: (p[P.pdfFilename]?.rich_text || []).map(t => t.plain_text).join(''),
    pcsId: (p[P.pcsId]?.rich_text || []).map(t => t.plain_text).join(''),
    existingDocId: (p[P.existingDocId]?.rich_text || []).map(t => t.plain_text).join(''),
    conflictAction: p[P.conflictAction]?.select?.name || null,
    extractedData: fromRichText(p[P.extractedData]?.rich_text),
    createdDocumentId: (p[P.createdDocumentId]?.rich_text || []).map(t => t.plain_text).join(''),
    resultCounts: (p[P.resultCounts]?.rich_text || []).map(t => t.plain_text).join(''),
    warnings: (p[P.warnings]?.rich_text || []).map(t => t.plain_text).join(''),
    error: (p[P.error]?.rich_text || []).map(t => t.plain_text).join(''),
    retryCount: p[P.retryCount]?.number ?? 0,
    batchId: (p[P.batchId]?.rich_text || []).map(t => t.plain_text).join(''),
    ownerEmail: p[P.ownerEmail]?.email || null,
    contentHash: (p[P.contentHash]?.rich_text || []).map(t => t.plain_text).join(''),
    promptVersion: (p[P.promptVersion]?.rich_text || []).map(t => t.plain_text).join(''),
    notificationSent: p[P.notificationSent]?.checkbox ?? false,
    diffReport: (() => {
      const raw = fromRichText(p[P.diffReport]?.rich_text);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    })(),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Fetch every job, newest first. Pages through all results.
 *
 * @param {number} maxPages - Safety cap on pagination loops.
 * @returns {Promise<object[]>} All jobs.
 */
export async function getAllJobs(maxPages = 50) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_import_jobs')
    .select('*')
    .order('notion_created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * Retrieve a single job by its Notion page ID.
 *
 * @param {string} id - Notion page ID.
 * @returns {Promise<object>} Parsed job.
 */
export async function getJob(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_import_jobs')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

/**
 * Fetch jobs with a given status, oldest-first (FIFO for worker).
 *
 * @param {string} status - One of the Status select values.
 * @param {number} limit - Max rows to return.
 * @returns {Promise<object[]>} Matching jobs.
 */
export async function getJobsByStatus(status, limit = 10) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-import-jobs] Supabase not configured');
  const { data, error } = await sb
    .from('pcs_import_jobs')
    .select('*')
    .eq('status', status)
    .order('notion_created_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * Fetch every job in a single batch.
 *
 * @param {string} batchId - Batch identifier assigned at stage time.
 * @returns {Promise<object[]>} Jobs sharing the same batch ID.
 */
export async function getJobsByBatch(batchId) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-import-jobs] Supabase not configured');
  const { data, error } = await sb
    .from('pcs_import_jobs')
    .select('*')
    .eq('batch_id', batchId)
    .order('notion_created_at', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * Fetch jobs in the given statuses whose `last_edited_time` is older than
 * the provided threshold. Used by the stale-state sweep.
 *
 * @param {string} status - Status to filter by.
 * @param {Date} olderThan - Cutoff timestamp.
 * @param {number} limit - Max rows to return.
 * @returns {Promise<object[]>} Stale jobs.
 */
export async function getStaleJobs(status, olderThan, limit = 10) {
  // `updated_at` is maintained by the trg_set_updated_at DB trigger on every
  // write, so it is an accurate staleness signal (it advances whenever the
  // runner touches a job).
  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-import-jobs] Supabase not configured');
  const { data, error } = await sb
    .from('pcs_import_jobs')
    .select('*')
    .eq('status', status)
    .lt('updated_at', olderThan.toISOString())
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * Find a prior job whose content hash matches (sha256 of PDF bytes). Matches
 * are limited to jobs in a "useful prior result" state (committed, extracted,
 * or committing) — jobs that failed or were skipped don't count as dedup hits.
 *
 * @param {string} hash - sha256 hex string.
 * @returns {Promise<object|null>} First matching job or null.
 */
export async function getJobByContentHash(hash) {
  if (!hash) return null;
  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-import-jobs] Supabase not configured');
  const { data, error } = await sb
    .from('pcs_import_jobs')
    .select('*')
    .eq('content_hash', hash)
    .in('status', ['committed', 'extracted', 'committing'])
    .order('notion_created_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  if (!data || !data.length) return null;
  return parsePostgresRow(data[0]);
}

/**
 * Parse a PCS ID out of a filename. Accepts forms like "PCS-0126...", "PCS126",
 * case-insensitive. Returns a zero-padded 4-digit PCS-XXXX string, or null.
 *
 * @param {string} filename
 * @returns {string|null}
 */
export function parsePcsIdFromFilename(filename) {
  if (!filename) return null;
  const m = String(filename).match(/^[^A-Za-z0-9]*PCS[-_ ]?(\d{3,4})/i);
  if (!m) return null;
  const num = m[1].padStart(4, '0');
  return `PCS-${num}`;
}

/**
 * Create a new import job. `Job ID` is auto-composed from pcsId + batchId +
 * a small random suffix so it's readable but unique.
 *
 * @param {object} opts
 * @param {string} opts.pdfUrl - Blob URL to the uploaded PDF.
 * @param {string} opts.pdfFilename - Original filename.
 * @param {string|null} [opts.pcsId] - Parsed from filename if available.
 * @param {string} [opts.conflictAction='skip'] - One of 'skip' | 'link'.
 * @param {string|null} [opts.existingDocId] - If the PCS already has a document.
 * @param {string} opts.batchId - Batch identifier.
 * @param {string} [opts.ownerEmail] - Email of the admin who staged the batch.
 * @param {string} [opts.initialStatus='queued'] - Starting status.
 * @returns {Promise<object>} Created job.
 */
export async function createJob({
  pdfUrl,
  pdfFilename,
  pcsId = null,
  conflictAction = 'skip',
  existingDocId = null,
  batchId,
  ownerEmail = null,
  initialStatus = 'queued',
  contentHash = null,
  promptVersion = null,
  error = null,
  warnings = null,
}) {
  const suffix = Math.random().toString(36).slice(2, 6);
  const jobId = `${pcsId || 'UNKNOWN'}-${batchId}-${suffix}`;

  const properties = {
    [P.jobId]: { title: [{ text: { content: jobId } }] },
    [P.status]: { select: { name: initialStatus } },
    [P.retryCount]: { number: 0 },
  };
  if (pdfUrl) properties[P.pdfUrl] = { url: pdfUrl };
  if (pdfFilename) properties[P.pdfFilename] = { rich_text: [{ text: { content: pdfFilename } }] };
  if (pcsId) properties[P.pcsId] = { rich_text: [{ text: { content: pcsId } }] };
  if (existingDocId) properties[P.existingDocId] = { rich_text: [{ text: { content: existingDocId } }] };
  if (conflictAction) properties[P.conflictAction] = { select: { name: conflictAction } };
  if (batchId) properties[P.batchId] = { rich_text: [{ text: { content: batchId } }] };
  if (ownerEmail) properties[P.ownerEmail] = { email: ownerEmail };
  if (contentHash) properties[P.contentHash] = { rich_text: [{ text: { content: contentHash } }] };
  if (promptVersion) properties[P.promptVersion] = { rich_text: [{ text: { content: promptVersion } }] };
  if (error) properties[P.error] = { rich_text: toRichText(error) };
  if (warnings) properties[P.warnings] = { rich_text: toRichText(warnings) };

  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    // Persist the FULL job row — the 2026-07 migration added the rich columns
    // (pdf_url, batch_id, content_hash, …) the extraction runner needs.
    // `createdTime` → notion_created_at gives new jobs a real FIFO timestamp.
    const stubRow = {
      id: preId,
      createdTime: new Date().toISOString(),
      jobId,
      pcsId: pcsId || '',
      status: initialStatus,
      pdfUrl: pdfUrl || null,
      pdfFilename: pdfFilename || '',
      existingDocId: existingDocId || '',
      conflictAction: conflictAction || null,
      batchId: batchId || '',
      ownerEmail: ownerEmail || null,
      contentHash: contentHash || '',
      promptVersion: promptVersion || '',
      retryCount: 0,
      error: error || '',
      warnings: warnings || '',
    };
    await writePostgresFirst('pcs_import_jobs', stubRow, IMPORT_JOBS_PG_COLUMN_MAP);
    // Return the full shape callers expect (with the rich fields) even though
    // only the slim Postgres subset was persisted.
    return {
      id: preId,
      jobId,
      status: initialStatus,
      pdfUrl: pdfUrl || null,
      pdfFilename: pdfFilename || '',
      pcsId: pcsId || '',
      existingDocId: existingDocId || '',
      conflictAction: conflictAction || 'skip',
      batchId: batchId || '',
      ownerEmail: ownerEmail || null,
      contentHash: contentHash || '',
      promptVersion: promptVersion || '',
      error: error || '',
      warnings: warnings || '',
    };
  }
}

/**
 * Sparse update — only writes properties that are explicitly set in `fields`.
 *
 * Supported keys: status, existingDocId, extractedData, createdDocumentId,
 * resultCounts, warnings, error, retryCount, conflictAction.
 *
 * Pass null for a string/select field to clear it; undefined means "leave as is".
 *
 * @param {string} id - Notion page ID.
 * @param {object} fields
 * @returns {Promise<object>} Updated job.
 */
export async function updateJob(id, fields) {
  const properties = {};
  if (fields.status !== undefined) {
    properties[P.status] = fields.status
      ? { select: { name: fields.status } }
      : { select: null };
  }
  if (fields.existingDocId !== undefined) {
    properties[P.existingDocId] = {
      rich_text: fields.existingDocId
        ? [{ text: { content: fields.existingDocId } }]
        : [],
    };
  }
  if (fields.conflictAction !== undefined) {
    properties[P.conflictAction] = fields.conflictAction
      ? { select: { name: fields.conflictAction } }
      : { select: null };
  }
  if (fields.extractedData !== undefined) {
    properties[P.extractedData] = {
      rich_text: toRichText(fields.extractedData || ''),
    };
  }
  if (fields.createdDocumentId !== undefined) {
    properties[P.createdDocumentId] = {
      rich_text: fields.createdDocumentId
        ? [{ text: { content: fields.createdDocumentId } }]
        : [],
    };
  }
  if (fields.resultCounts !== undefined) {
    properties[P.resultCounts] = {
      rich_text: toRichText(fields.resultCounts || ''),
    };
  }
  if (fields.warnings !== undefined) {
    properties[P.warnings] = { rich_text: toRichText(fields.warnings || '') };
  }
  if (fields.error !== undefined) {
    properties[P.error] = { rich_text: toRichText(fields.error || '') };
  }
  if (fields.retryCount !== undefined) {
    properties[P.retryCount] = { number: fields.retryCount };
  }
  if (fields.promptVersion !== undefined) {
    properties[P.promptVersion] = {
      rich_text: fields.promptVersion
        ? [{ text: { content: fields.promptVersion } }]
        : [],
    };
  }
  if (fields.contentHash !== undefined) {
    properties[P.contentHash] = {
      rich_text: fields.contentHash
        ? [{ text: { content: fields.contentHash } }]
        : [],
    };
  }
  if (fields.notificationSent !== undefined) {
    properties[P.notificationSent] = { checkbox: !!fields.notificationSent };
  }
  if (fields.diffReport !== undefined) {
    // Plain object in → chunked rich_text out. Pass null to clear.
    const serialized = fields.diffReport === null ? '' : JSON.stringify(fields.diffReport);
    properties[P.diffReport] = { rich_text: toRichText(serialized) };
  }
  if (shouldWriteToPostgresFirst()) {
    // Persist every mutated column to Postgres (the single source of truth).
    // `updated_at` is maintained by the DB trigger for the stale sweep.
    const pgFields = { id, lastEditedTime: new Date().toISOString() };
    if (fields.status !== undefined) pgFields.status = fields.status;
    if (fields.error !== undefined) pgFields.error = fields.error;
    if (fields.pcsId !== undefined) pgFields.pcsId = fields.pcsId;
    if (fields.existingDocId !== undefined) pgFields.existingDocId = fields.existingDocId;
    if (fields.conflictAction !== undefined) pgFields.conflictAction = fields.conflictAction;
    if (fields.extractedData !== undefined) pgFields.extractedData = fields.extractedData;
    if (fields.createdDocumentId !== undefined) pgFields.createdDocumentId = fields.createdDocumentId;
    if (fields.resultCounts !== undefined) pgFields.resultCounts = fields.resultCounts;
    if (fields.warnings !== undefined) pgFields.warnings = fields.warnings;
    if (fields.retryCount !== undefined) pgFields.retryCount = fields.retryCount;
    if (fields.promptVersion !== undefined) pgFields.promptVersion = fields.promptVersion;
    if (fields.contentHash !== undefined) pgFields.contentHash = fields.contentHash;
    if (fields.notificationSent !== undefined) pgFields.notificationSent = fields.notificationSent;
    if (fields.diffReport !== undefined) {
      pgFields.diffReport = fields.diffReport === null ? null : JSON.stringify(fields.diffReport);
    }
    await writePostgresFirst('pcs_import_jobs', pgFields, IMPORT_JOBS_PG_COLUMN_MAP);
    return { id, ...fields };
  }
}
