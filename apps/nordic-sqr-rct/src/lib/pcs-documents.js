/**
 * PCS Documents CRUD — the top-level entity in the PCS hierarchy.
 *
 * PCS Document → PCS Versions → Claims → Evidence Packets
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.documents;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    pcsId: p[P.pcsId]?.title?.[0]?.plain_text || '',
    classification: p[P.classification]?.select?.name || null,
    fileStatus: p[P.fileStatus]?.select?.name || null,
    productStatus: p[P.productStatus]?.select?.name || null,
    transferStatus: p[P.transferStatus]?.select?.name || null,
    documentNotes: (p[P.documentNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    approvedDate: p[P.approvedDate]?.date?.start || null,
    latestVersionId: (p[P.latestVersion]?.relation || [])[0]?.id || null,
    allVersionIds: (p[P.allVersions]?.relation || []).map(r => r.id),
    // Lauren's template Table B fields — added 2026-04-18
    finishedGoodName: (p[P.finishedGoodName]?.rich_text || []).map(t => t.plain_text).join(''),
    format: p[P.format]?.select?.name || null,
    sapMaterialNo: (p[P.sapMaterialNo]?.rich_text || []).map(t => t.plain_text).join(''),
    skus: (p[P.skus]?.multi_select || []).map(s => s.name),
    archived: p[P.archived]?.checkbox || false,
    // Template-version classification — added 2026-04-21
    templateVersion: p[P.templateVersion]?.select?.name || null,
    templateSignals: (p[P.templateSignals]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllDocuments(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.documents,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: P.pcsId, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getDocument(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getDocumentByPcsId(pcsId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.documents,
    filter: { property: P.pcsId, title: { equals: pcsId } },
    page_size: 1,
  });
  return res.results.length > 0 ? parsePage(res.results[0]) : null;
}

export async function getDocumentsByStatus(fileStatus) {
  const res = await notion.databases.query({
    database_id: PCS_DB.documents,
    filter: { property: P.fileStatus, select: { equals: fileStatus } },
    sorts: [{ property: P.pcsId, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function updateDocument(id, fields) {
  const properties = {};
  if (fields.classification !== undefined) {
    properties[P.classification] = { select: { name: fields.classification } };
  }
  if (fields.fileStatus !== undefined) {
    properties[P.fileStatus] = { select: { name: fields.fileStatus } };
  }
  if (fields.productStatus !== undefined) {
    properties[P.productStatus] = { select: { name: fields.productStatus } };
  }
  if (fields.transferStatus !== undefined) {
    properties[P.transferStatus] = { select: { name: fields.transferStatus } };
  }
  if (fields.documentNotes !== undefined) {
    properties[P.documentNotes] = { rich_text: [{ text: { content: fields.documentNotes } }] };
  }
  if (fields.approvedDate !== undefined) {
    properties[P.approvedDate] = fields.approvedDate
      ? { date: { start: fields.approvedDate } }
      : { date: null };
  }
  // Lauren's template Table B fields — added 2026-04-18
  if (fields.finishedGoodName !== undefined) {
    properties[P.finishedGoodName] = { rich_text: [{ text: { content: fields.finishedGoodName || '' } }] };
  }
  if (fields.format !== undefined) {
    properties[P.format] = fields.format ? { select: { name: fields.format } } : { select: null };
  }
  if (fields.sapMaterialNo !== undefined) {
    properties[P.sapMaterialNo] = { rich_text: [{ text: { content: fields.sapMaterialNo || '' } }] };
  }
  if (fields.skus !== undefined) {
    properties[P.skus] = { multi_select: (fields.skus || []).map(name => ({ name })) };
  }
  if (fields.archived !== undefined) {
    properties[P.archived] = { checkbox: !!fields.archived };
  }
  // Template-version classification — added 2026-04-21
  if (fields.templateVersion !== undefined) {
    properties[P.templateVersion] = fields.templateVersion
      ? { select: { name: fields.templateVersion } }
      : { select: null };
  }
  if (fields.templateSignals !== undefined) {
    properties[P.templateSignals] = { rich_text: [{ text: { content: fields.templateSignals || '' } }] };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

/**
 * Wave 8 Phase C2 — allowlist of single-field paths editable via
 * `updateDocumentField`. Kept narrow on purpose: anything not here must go
 * through `updateDocument` (bulk) or get a new helper + capability check.
 */
export const DOCUMENT_EDITABLE_FIELDS = Object.freeze([
  'finishedGoodName',
  'format',
  'sapMaterialNo',
  'skus',
  'documentNotes',
  'fileStatus',
  'productStatus',
  'transferStatus',
]);

/**
 * Wave 8 Phase C2 — single-field document edit that threads through `mutate()`
 * so an audit row lands in PCS Revisions for every write.
 *
 * @param {object} args
 * @param {string}  args.id         Notion page id of the PCS Document
 * @param {string}  args.fieldPath  one of DOCUMENT_EDITABLE_FIELDS
 * @param {*}       args.value      new value (scalar or array for `skus`)
 * @param {object}  [args.actor]    { email, roles } — falls back to system
 * @param {string}  [args.reason]   optional operator note
 */
export async function updateDocumentField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateDocumentField: id is required.');
  if (!DOCUMENT_EDITABLE_FIELDS.includes(fieldPath)) {
    throw new Error(`updateDocumentField: fieldPath "${fieldPath}" is not editable.`);
  }
  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.PCS_DOCUMENT,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: async (pageId) => getDocument(pageId),
    apply: async () => updateDocument(id, { [fieldPath]: value }),
  });
}

/**
 * Repoint a PCS Document's `latestVersion` relation to the given version id.
 *
 * Call this immediately after creating a new version + unsetting isLatest on
 * the old one. `src/lib/label-drift.js` reads `pcs.latestVersionId` directly,
 * so without this call drift detection may run against a stale version.
 */
export async function setLatestVersion(documentId, versionId) {
  if (!documentId) throw new Error('setLatestVersion: documentId required');
  const properties = {
    [P.latestVersion]: versionId ? { relation: [{ id: versionId }] } : { relation: [] },
  };
  const page = await notion.pages.update({ page_id: documentId, properties });
  return parsePage(page);
}

export async function createDocument(fields) {
  const properties = {
    [P.pcsId]: { title: [{ text: { content: fields.pcsId } }] },
  };
  if (fields.classification) properties[P.classification] = { select: { name: fields.classification } };
  if (fields.fileStatus) properties[P.fileStatus] = { select: { name: fields.fileStatus } };
  if (fields.productStatus) properties[P.productStatus] = { select: { name: fields.productStatus } };
  if (fields.transferStatus) properties[P.transferStatus] = { select: { name: fields.transferStatus } };
  if (fields.documentNotes) properties[P.documentNotes] = { rich_text: [{ text: { content: fields.documentNotes } }] };
  // Lauren's template Table B fields — added 2026-04-18
  if (fields.finishedGoodName) properties[P.finishedGoodName] = { rich_text: [{ text: { content: fields.finishedGoodName } }] };
  if (fields.format) properties[P.format] = { select: { name: fields.format } };
  if (fields.sapMaterialNo) properties[P.sapMaterialNo] = { rich_text: [{ text: { content: fields.sapMaterialNo } }] };
  if (fields.skus?.length) properties[P.skus] = { multi_select: fields.skus.map(name => ({ name })) };
  if (fields.archived !== undefined) properties[P.archived] = { checkbox: !!fields.archived };
  // Template-version classification — added 2026-04-21
  if (fields.templateVersion) properties[P.templateVersion] = { select: { name: fields.templateVersion } };
  if (fields.templateSignals) properties[P.templateSignals] = { rich_text: [{ text: { content: fields.templateSignals } }] };

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.documents },
    properties,
  });
  return parsePage(page);
}
