/**
 * Label Intake Queue CRUD — durable job queue for Wave 5.3 label imports.
 *
 * Rows flow through:
 *   Pending → Extracting → (Needs Validation | Committed | Failed | Cancelled)
 *
 * Mirrors the shape of src/lib/pcs-import-jobs.js, trimmed to the fields the
 * label-extraction path needs. The full Claude Vision extraction JSON is
 * chunked into Notion rich_text runs on `Extraction Data`.
 *
 * Added 2026-04-21 as part of Wave 5.3 (permanent label import UI).
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';

const Q = PROPS.labelIntakeQueue;

// Notion rich_text: 2000-char cap per run, 100 runs per property.
const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 100;

function chunkString(str) {
  if (!str) return [];
  const chunks = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) {
    chunks.push(str.slice(i, i + CHUNK_SIZE));
    if (chunks.length >= MAX_CHUNKS) break;
  }
  return chunks;
}

function toRichText(str) {
  const chunks = chunkString(str || '');
  if (chunks.length === 0) return [];
  return chunks.map(c => ({ text: { content: c } }));
}

function fromRichText(richText) {
  return (richText || []).map(t => t.plain_text || t.text?.content || '').join('');
}

/**
 * Map a Notion page into a plain intake-queue row object.
 */
export function parseQueueRow(page) {
  const p = page.properties;
  return {
    id: page.id,
    sku: p[Q.sku]?.title?.[0]?.plain_text || '',
    pcsId: (p[Q.pcsId]?.rich_text || []).map(t => t.plain_text).join(''),
    productName: (p[Q.productName]?.rich_text || []).map(t => t.plain_text).join(''),
    files: (p[Q.labelFile]?.files || []).map(f => ({
      name: f.name,
      url: f.external?.url || f.file?.url || null,
      external: f.external,
      file: f.file,
    })),
    dateReceived: p[Q.dateReceived]?.date?.start || null,
    market: (p[Q.market]?.rich_text || []).map(t => t.plain_text).join(''),
    regulatory: p[Q.regulatory]?.select?.name || null,
    ingested: p[Q.ingested]?.checkbox || false,
    ingestedLabelId: (p[Q.ingestedLabel]?.relation || [])[0]?.id || null,
    notes: (p[Q.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    status: p[Q.status]?.select?.name || null,
    contentHash: (p[Q.contentHash]?.rich_text || []).map(t => t.plain_text).join(''),
    extractionData: fromRichText(p[Q.extractionData]?.rich_text),
    error: (p[Q.error]?.rich_text || []).map(t => t.plain_text).join(''),
    retryCount: p[Q.retryCount]?.number ?? 0,
    promptVersion: (p[Q.promptVersion]?.rich_text || []).map(t => t.plain_text).join(''),
    batchId: (p[Q.batchId]?.rich_text || []).map(t => t.plain_text).join(''),
    confidenceOverall: p[Q.confidenceOverall]?.number ?? null,
    ownerEmail: p[Q.ownerEmail]?.email || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Fetch every row, newest first.
 */
export async function getAllIntakeRows(maxPages = 20) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.labelIntakeQueue,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parseQueueRow);
}

export async function getIntakeRow(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parseQueueRow(page);
}

export async function getIntakeRowsByStatus(status, limit = 10) {
  const res = await notion.databases.query({
    database_id: PCS_DB.labelIntakeQueue,
    page_size: Math.min(limit, 100),
    filter: { property: Q.status, select: { equals: status } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return res.results.map(parseQueueRow);
}

export async function getIntakeRowsByBatch(batchId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.labelIntakeQueue,
    page_size: 100,
    filter: { property: Q.batchId, rich_text: { equals: batchId } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return res.results.map(parseQueueRow);
}

/**
 * Stale-sweep helper — rows stuck in `Extracting` older than cutoff.
 */
export async function getStaleIntakeRows(status, olderThan, limit = 10) {
  const res = await notion.databases.query({
    database_id: PCS_DB.labelIntakeQueue,
    page_size: Math.min(limit, 100),
    filter: {
      and: [
        { property: Q.status, select: { equals: status } },
        { timestamp: 'last_edited_time', last_edited_time: { before: olderThan.toISOString() } },
      ],
    },
    sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }],
  });
  return res.results.map(parseQueueRow);
}

/**
 * Dedup lookup by content hash (sha256 of label image bytes).
 * Matches any non-Cancelled prior row so operators see the prior context.
 */
export async function getIntakeRowByContentHash(hash) {
  if (!hash) return null;
  const res = await notion.databases.query({
    database_id: PCS_DB.labelIntakeQueue,
    page_size: 5,
    filter: {
      and: [
        { property: Q.contentHash, rich_text: { equals: hash } },
        { property: Q.status, select: { does_not_equal: 'Cancelled' } },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  });
  if (!res.results.length) return null;
  return parseQueueRow(res.results[0]);
}

/**
 * Create a new intake row. Title = SKU if known, else a placeholder
 * "LABEL-<batchId>-<n>" to keep the row findable while the operator fills in SKU.
 */
export async function createIntakeRow({
  sku = '',
  pcsId = null,
  productName = null,
  labelFile, // { url, name } — required
  batchId,
  ownerEmail = null,
  contentHash = null,
  regulatory = null,
  market = null,
  notes = null,
  initialStatus = 'Pending',
  error = null,
}) {
  if (!labelFile || !labelFile.url) {
    throw new Error('createIntakeRow: labelFile.url is required');
  }
  const properties = {
    [Q.sku]: { title: [{ text: { content: sku || `LABEL-${batchId || 'UNK'}-${Math.random().toString(36).slice(2, 6)}` } }] },
    [Q.status]: { select: { name: initialStatus } },
    [Q.retryCount]: { number: 0 },
    [Q.labelFile]: {
      files: [{
        name: labelFile.name || 'label',
        type: 'external',
        external: { url: labelFile.url },
      }],
    },
    [Q.dateReceived]: { date: { start: new Date().toISOString().slice(0, 10) } },
    [Q.ingested]: { checkbox: false },
  };
  if (pcsId) properties[Q.pcsId] = { rich_text: [{ text: { content: pcsId } }] };
  if (productName) properties[Q.productName] = { rich_text: [{ text: { content: productName } }] };
  if (batchId) properties[Q.batchId] = { rich_text: [{ text: { content: batchId } }] };
  if (ownerEmail) properties[Q.ownerEmail] = { email: ownerEmail };
  if (contentHash) properties[Q.contentHash] = { rich_text: [{ text: { content: contentHash } }] };
  if (regulatory) properties[Q.regulatory] = { select: { name: regulatory } };
  if (market) properties[Q.market] = { rich_text: [{ text: { content: market } }] };
  if (notes) properties[Q.notes] = { rich_text: toRichText(notes) };
  if (error) properties[Q.error] = { rich_text: toRichText(error) };

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.labelIntakeQueue },
    properties,
  });
  return parseQueueRow(page);
}

/**
 * Sparse update — only writes properties explicitly present in `fields`.
 * Pass null to clear a string/select field; undefined leaves as-is.
 */
export async function updateIntakeRow(id, fields) {
  const properties = {};
  if (fields.sku !== undefined) {
    properties[Q.sku] = { title: [{ text: { content: fields.sku || '' } }] };
  }
  if (fields.pcsId !== undefined) {
    properties[Q.pcsId] = {
      rich_text: fields.pcsId ? [{ text: { content: fields.pcsId } }] : [],
    };
  }
  if (fields.productName !== undefined) {
    properties[Q.productName] = {
      rich_text: fields.productName ? [{ text: { content: fields.productName } }] : [],
    };
  }
  if (fields.status !== undefined) {
    properties[Q.status] = fields.status ? { select: { name: fields.status } } : { select: null };
  }
  if (fields.regulatory !== undefined) {
    properties[Q.regulatory] = fields.regulatory ? { select: { name: fields.regulatory } } : { select: null };
  }
  if (fields.market !== undefined) {
    properties[Q.market] = {
      rich_text: fields.market ? [{ text: { content: fields.market } }] : [],
    };
  }
  if (fields.notes !== undefined) {
    properties[Q.notes] = { rich_text: toRichText(fields.notes || '') };
  }
  if (fields.error !== undefined) {
    properties[Q.error] = { rich_text: toRichText(fields.error || '') };
  }
  if (fields.extractionData !== undefined) {
    properties[Q.extractionData] = { rich_text: toRichText(fields.extractionData || '') };
  }
  if (fields.retryCount !== undefined) {
    properties[Q.retryCount] = { number: fields.retryCount };
  }
  if (fields.promptVersion !== undefined) {
    properties[Q.promptVersion] = {
      rich_text: fields.promptVersion ? [{ text: { content: fields.promptVersion } }] : [],
    };
  }
  if (fields.batchId !== undefined) {
    properties[Q.batchId] = {
      rich_text: fields.batchId ? [{ text: { content: fields.batchId } }] : [],
    };
  }
  if (fields.confidenceOverall !== undefined) {
    properties[Q.confidenceOverall] = { number: fields.confidenceOverall };
  }
  if (fields.contentHash !== undefined) {
    properties[Q.contentHash] = {
      rich_text: fields.contentHash ? [{ text: { content: fields.contentHash } }] : [],
    };
  }
  if (fields.ingested !== undefined) {
    properties[Q.ingested] = { checkbox: !!fields.ingested };
  }
  if (fields.ingestedLabelId !== undefined) {
    properties[Q.ingestedLabel] = {
      relation: fields.ingestedLabelId ? [{ id: fields.ingestedLabelId }] : [],
    };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parseQueueRow(page);
}
