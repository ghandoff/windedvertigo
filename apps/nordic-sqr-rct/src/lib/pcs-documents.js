/**
 * PCS Documents CRUD — the top-level entity in the PCS hierarchy.
 *
 * PCS Document → PCS Versions → Claims → Evidence Packets
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';
import { memoize, invalidate as invalidateCache } from './in-memory-cache.js';
import { getPcsSupabase, shouldReadFromPostgres, mirrorToPostgres, shouldUseStrongConsistency } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Phase A. No special column-name overrides for
// pcs_documents; all fields follow the camelCase → snake_case convention.
const DOCUMENTS_PG_COLUMN_MAP = {};

// 2026-05-05 — Phase 3 Bundle 1. Documents list paginates Notion;
// /pcs/documents and /api/pcs/dashboard both call getAllDocuments.
// 60s in-memory cache + invalidation on writes. Same pattern as
// pcs-evidence.js / pcs-claims.js / Phase 2's pcs-ingredients.js.
const DOCUMENTS_CACHE_KEY = 'documents:all:50';
const DOCUMENTS_CACHE_TTL_MS = 60_000;

export function invalidateDocumentsCache() {
  invalidateCache(DOCUMENTS_CACHE_KEY);
}


const P = PROPS.documents;

/**
 * 2026-05-06 — Path-2 read-path swap. Convert a pcs_documents row
 * into the same JS shape parsePage(notionPage) returns.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    pcsId: row.pcs_id || '',
    classification: row.classification || null,
    fileStatus: row.file_status || null,
    productStatus: row.product_status || null,
    transferStatus: row.transfer_status || null,
    documentNotes: row.document_notes || '',
    approvedDate: row.approved_date || null,
    latestVersionId: row.latest_version_id || null,
    allVersionIds: row.all_version_ids || [],
    finishedGoodName: row.finished_good_name || '',
    format: row.format || null,
    sapMaterialNo: row.sap_material_no || '',
    skus: row.skus || [],
    archived: row.archived || false,
    templateVersion: row.template_version || null,
    templateSignals: row.template_signals || '',
    linkedAicsIds: row.linked_aics_ids || [],
    canonicalDocumentId: row.canonical_document_id || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

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
    // Bundle 3.4 — Linked AICS docs (Notion DUAL relation). Each id is a
    // Notion page id in the AICS Documents data source. RA may link AICS
    // docs directly in Notion; the picker UI is Phase 3.4 P2.
    linkedAicsIds: (p[P.linkedAics]?.relation || []).map(r => r.id),
    // 2026-05-04 — soft-merge dedup target. Non-null on duplicate rows;
    // points at the canonical row this duplicate folds into.
    canonicalDocumentId: (p[P.canonicalDocument]?.relation || [])[0]?.id || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllDocuments(maxPages = 50, opts = {}) {
  if (maxPages === 50 && !opts.skipCache) {
    return memoize(DOCUMENTS_CACHE_KEY, DOCUMENTS_CACHE_TTL_MS, () =>
      _fetchAllDocuments(maxPages),
    );
  }
  return _fetchAllDocuments(maxPages);
}

async function _fetchAllDocuments(maxPages) {
  // 2026-05-06 — Path-2 read-path swap. Postgres-first when the flag
  // is on, Notion fallback on any error. Same pattern as evidence + claims.
  if (shouldReadFromPostgres()) {
    try {
      return await _fetchAllDocumentsFromPostgres();
    } catch (err) {
      console.warn(`[pcs-documents] Postgres read failed, falling back to Notion: ${err.message}`);
    }
  }
  return _fetchAllDocumentsFromNotion(maxPages);
}

async function _fetchAllDocumentsFromNotion(maxPages) {
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

/**
 * 2026-05-06 — Path-2 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentDocumentsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.documents,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_documents', parsed, DOCUMENTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
}

/**
 * Sync a single Notion page into Postgres by page ID.
 * Used by the general page-updated webhook to mirror a specific
 * edited row immediately rather than waiting for the drift-sync cron.
 *
 * @param {string} pageId — Notion page ID
 */
export async function syncSingleDocumentPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_documents', parsed, DOCUMENTS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
}

async function _fetchAllDocumentsFromPostgres() {
  // 38 rows today, sorted by pcs_id ascending to match Notion behavior.
  // (Notion's getAllDocuments uses pcsId-ascending; we preserve that
  //  here even though the page-level default sort is now lastEditedTime.)
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_documents')
    .select('*')
    .order('pcs_id', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getDocument(id) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_documents')
        .select('*')
        .eq('notion_page_id', id)
        .maybeSingle();
      if (error) throw error;
      if (data) return parsePostgresRow(data);
    } catch (err) {
      console.warn(`[pcs-documents] Postgres single-row read failed, falling back to Notion: ${err.message}`);
    }
  }
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getDocumentByPcsId(pcsId) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      // pcs_documents.pcs_id is indexed (pcs_documents_pcs_id_idx).
      const { data, error } = await sb
        .from('pcs_documents')
        .select('*')
        .eq('pcs_id', pcsId)
        .maybeSingle();
      if (error) throw error;
      if (data) return parsePostgresRow(data);
      // Not found in Postgres — could be a brand-new document. Fall
      // through to Notion to confirm it really doesn't exist.
    } catch (err) {
      console.warn(`[pcs-documents] Postgres byPcsId failed, falling back to Notion: ${err.message}`);
    }
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.documents,
    filter: { property: P.pcsId, title: { equals: pcsId } },
    page_size: 1,
  });
  return res.results.length > 0 ? parsePage(res.results[0]) : null;
}

export async function getDocumentsByStatus(fileStatus) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      // pcs_documents.file_status is indexed (pcs_documents_file_status_idx).
      const { data, error } = await sb
        .from('pcs_documents')
        .select('*')
        .eq('file_status', fileStatus)
        .order('pcs_id', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data || []).map(parsePostgresRow);
    } catch (err) {
      console.warn(`[pcs-documents] Postgres byStatus failed, falling back to Notion: ${err.message}`);
    }
  }
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
  // 2026-05-04 — soft-merge dedup. Set this to the canonical row's page id
  // to mark this row as a duplicate. Pass null/empty to clear.
  if (fields.canonicalDocumentId !== undefined) {
    properties[P.canonicalDocument] = fields.canonicalDocumentId
      ? { relation: [{ id: fields.canonicalDocumentId }] }
      : { relation: [] };
  }
  // Bundle 3.4 P2 — Linked AICS relation (full-replace semantics).
  if (fields.linkedAicsIds !== undefined) {
    properties[P.linkedAics] = { relation: (fields.linkedAicsIds || []).map((rid) => ({ id: rid })) };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  invalidateDocumentsCache();
  const parsed = parsePage(page);
  // 2026-05-06 — Path-2 Phase A write-mirror.
  await mirrorToPostgres('pcs_documents', parsed, DOCUMENTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
}

/**
 * Bundle 3.4 P2 — append a single AICS doc to this PCS doc's `Linked AICS`
 * relation. No-op (idempotent) if already linked. Returns the parsed PCS doc.
 */
export async function linkAicsToDocument(documentId, aicsDocumentId) {
  if (!documentId) throw new Error('linkAicsToDocument: documentId is required.');
  if (!aicsDocumentId) throw new Error('linkAicsToDocument: aicsDocumentId is required.');
  const current = await getDocument(documentId);
  const existing = current.linkedAicsIds || [];
  if (existing.includes(aicsDocumentId)) return current; // idempotent
  return updateDocument(documentId, { linkedAicsIds: [...existing, aicsDocumentId] });
}

/**
 * Bundle 3.4 P2 — remove a single AICS doc from this PCS doc's `Linked AICS`
 * relation. No-op if not present. Returns the parsed PCS doc.
 */
export async function unlinkAicsFromDocument(documentId, aicsDocumentId) {
  if (!documentId) throw new Error('unlinkAicsFromDocument: documentId is required.');
  if (!aicsDocumentId) throw new Error('unlinkAicsFromDocument: aicsDocumentId is required.');
  const current = await getDocument(documentId);
  const existing = current.linkedAicsIds || [];
  if (!existing.includes(aicsDocumentId)) return current; // idempotent
  return updateDocument(documentId, { linkedAicsIds: existing.filter((rid) => rid !== aicsDocumentId) });
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
  invalidateDocumentsCache();
  const parsed = parsePage(page);
  // 2026-05-06 — Path-2 Phase A write-mirror.
  await mirrorToPostgres('pcs_documents', parsed, DOCUMENTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
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
  invalidateDocumentsCache();
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_documents', parsed, DOCUMENTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
}
