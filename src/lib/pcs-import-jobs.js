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

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.importJobs;

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
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.importJobs,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

/**
 * Retrieve a single job by its Notion page ID.
 *
 * @param {string} id - Notion page ID.
 * @returns {Promise<object>} Parsed job.
 */
export async function getJob(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

/**
 * Fetch jobs with a given status, oldest-first (FIFO for worker).
 *
 * @param {string} status - One of the Status select values.
 * @param {number} limit - Max rows to return.
 * @returns {Promise<object[]>} Matching jobs.
 */
export async function getJobsByStatus(status, limit = 10) {
  const res = await notion.databases.query({
    database_id: PCS_DB.importJobs,
    page_size: Math.min(limit, 100),
    filter: { property: P.status, select: { equals: status } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

/**
 * Fetch every job in a single batch.
 *
 * @param {string} batchId - Batch identifier assigned at stage time.
 * @returns {Promise<object[]>} Jobs sharing the same batch ID.
 */
export async function getJobsByBatch(batchId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.importJobs,
    page_size: 100,
    filter: { property: P.batchId, rich_text: { equals: batchId } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return res.results.map(parsePage);
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
  const res = await notion.databases.query({
    database_id: PCS_DB.importJobs,
    page_size: Math.min(limit, 100),
    filter: {
      and: [
        { property: P.status, select: { equals: status } },
        { timestamp: 'last_edited_time', last_edited_time: { before: olderThan.toISOString() } },
      ],
    },
    sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }],
  });
  return res.results.map(parsePage);
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
  const res = await notion.databases.query({
    database_id: PCS_DB.importJobs,
    page_size: 10,
    filter: {
      and: [
        { property: P.contentHash, rich_text: { equals: hash } },
        {
          or: [
            { property: P.status, select: { equals: 'committed' } },
            { property: P.status, select: { equals: 'extracted' } },
            { property: P.status, select: { equals: 'committing' } },
          ],
        },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  });
  if (!res.results.length) return null;
  return parsePage(res.results[0]);
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

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.importJobs },
    properties,
  });
  return parsePage(page);
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
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
