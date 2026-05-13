/**
 * AICS Documents / Versions / Claims CRUD — upstream sibling of PCS.
 *
 * AICS = Active Ingredient Claims Substantiation. Where a PCS doc lives at
 * the product level (e.g. "Vit D3 Children's Gummy"), an AICS doc lives at
 * the active-ingredient level (e.g. "Vit D3"). One AICS feeds many PCS docs
 * by reference (see `pcs_aics_references` in 003_aics_entity_ddl.sql).
 *
 * This module mirrors the Notion-only pattern in `pcs-documents.js` /
 * `pcs-versions.js` / `pcs-claims.js`. The Postgres mirror tables defined in
 * `db/migrations/003_aics_entity_ddl.sql` are not yet populated; the DDL
 * migration is awaiting separate authorization and a backfill step. Until
 * then these helpers are write-through to Notion only.
 *
 * Bundle 3 Phase 3.2 — adds entity helpers + API routes (this file).
 * Bundle 3 Phase 3.3 — UI pages at /pcs/aics (deferred).
 * Bundle 3 Phase 3.4+ — Postgres dual-write once migration applies.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';

const PD = PROPS.aicsDocuments;
const PV = PROPS.aicsVersions;
const PC = PROPS.aicsClaims;

// ─── Documents ───────────────────────────────────────────────────────────

function parseAicsDocumentPage(page) {
  const p = page.properties;
  return {
    id: page.id,
    aicsId: p[PD.aicsId]?.title?.[0]?.plain_text || '',
    aiName: (p[PD.aiName]?.rich_text || []).map(t => t.plain_text).join(''),
    classification: p[PD.classification]?.select?.name || null,
    fileStatus: p[PD.fileStatus]?.select?.name || null,
    raReviewStatus: p[PD.raReviewStatus]?.select?.name || null,
    documentNotes: (p[PD.documentNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    approvedDate: p[PD.approvedDate]?.date?.start || null,
    latestVersionId: (p[PD.latestVersion]?.relation || [])[0]?.id || null,
    allVersionIds: (p[PD.allVersions]?.relation || []).map(r => r.id),
    archived: p[PD.archived]?.checkbox || false,
    templateVersion: p[PD.templateVersion]?.select?.name || null,
    templateSignals: (p[PD.templateSignals]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Fetch a single AICS document by its Notion page id.
 */
export async function getAicsDocument(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parseAicsDocumentPage(page);
}

/**
 * Paginated list of AICS documents. Honors an optional `status` filter
 * (matched against `RA review status`) so the sidebar's "Pending RA Review"
 * link can `?status=Pending RA Review` directly into the same endpoint.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=100]
 * @param {string} [opts.cursor]   Notion `start_cursor` for pagination
 * @param {string} [opts.status]   exact match on raReviewStatus (e.g. 'Pending RA Review')
 */
export async function listAicsDocuments({ limit = 100, cursor, status } = {}) {
  // AICS Notion DBs aren't always provisioned — wrangler.jsonc notes the
  // NOTION_AICS_* env bindings as optional ("not yet populated — AICS features
  // inactive"). Without a database_id the Notion client throws and the API
  // route returns 500; the sidebar still surfaces /pcs/aics links so this
  // path is reachable in normal navigation. Degrade to an empty list instead.
  if (!PCS_DB.aicsDocuments) {
    return { items: [], nextCursor: null };
  }
  const query = {
    database_id: PCS_DB.aicsDocuments,
    page_size: Math.min(limit, 100),
    sorts: [{ property: PD.aicsId, direction: 'ascending' }],
  };
  if (cursor) query.start_cursor = cursor;
  if (status) {
    query.filter = { property: PD.raReviewStatus, select: { equals: status } };
  }
  const res = await notion.databases.query(query);
  return {
    items: res.results.map(parseAicsDocumentPage),
    nextCursor: res.has_more ? res.next_cursor : null,
  };
}

/**
 * Build the Notion properties payload from an AICS-document field bag.
 * Shared between create + update so the field handling stays single-source.
 */
function aicsDocumentProps(fields) {
  const out = {};
  if (fields.aicsId !== undefined) {
    out[PD.aicsId] = { title: [{ text: { content: fields.aicsId || '' } }] };
  }
  if (fields.aiName !== undefined) {
    out[PD.aiName] = { rich_text: [{ text: { content: fields.aiName || '' } }] };
  }
  if (fields.classification !== undefined) {
    out[PD.classification] = fields.classification
      ? { select: { name: fields.classification } }
      : { select: null };
  }
  if (fields.fileStatus !== undefined) {
    out[PD.fileStatus] = fields.fileStatus
      ? { select: { name: fields.fileStatus } }
      : { select: null };
  }
  if (fields.raReviewStatus !== undefined) {
    out[PD.raReviewStatus] = fields.raReviewStatus
      ? { select: { name: fields.raReviewStatus } }
      : { select: null };
  }
  if (fields.documentNotes !== undefined) {
    out[PD.documentNotes] = { rich_text: [{ text: { content: fields.documentNotes || '' } }] };
  }
  if (fields.approvedDate !== undefined) {
    out[PD.approvedDate] = fields.approvedDate ? { date: { start: fields.approvedDate } } : { date: null };
  }
  if (fields.archived !== undefined) {
    out[PD.archived] = { checkbox: !!fields.archived };
  }
  if (fields.templateVersion !== undefined) {
    out[PD.templateVersion] = fields.templateVersion
      ? { select: { name: fields.templateVersion } }
      : { select: null };
  }
  if (fields.templateSignals !== undefined) {
    out[PD.templateSignals] = { rich_text: [{ text: { content: fields.templateSignals || '' } }] };
  }
  return out;
}

/**
 * Create an AICS document. `aicsId` is the only required field (it backs the
 * Notion title column).
 */
export async function createAicsDocument(fields) {
  if (!fields?.aicsId) throw new Error('createAicsDocument: aicsId is required.');
  const properties = aicsDocumentProps(fields);
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.aicsDocuments },
    properties,
  });
  return parseAicsDocumentPage(page);
}

/**
 * Patch an AICS document. Only fields present in `patch` are written.
 */
export async function updateAicsDocument(id, patch) {
  if (!id) throw new Error('updateAicsDocument: id is required.');
  const properties = aicsDocumentProps(patch || {});
  const page = await notion.pages.update({ page_id: id, properties });
  return parseAicsDocumentPage(page);
}

// ─── Versions ────────────────────────────────────────────────────────────

function parseAicsVersionPage(page) {
  const p = page.properties;
  return {
    id: page.id,
    version: p[PV.version]?.title?.[0]?.plain_text || '',
    aicsDocumentId: (p[PV.aicsDocument]?.relation || [])[0]?.id || null,
    isLatest: p[PV.isLatest]?.checkbox || false,
    effectiveDate: p[PV.effectiveDate]?.date?.start || null,
    changeDescription: (p[PV.changeDescription]?.rich_text || []).map(t => t.plain_text).join(''),
    responsibleDept: p[PV.responsibleDept]?.select?.name || null,
    responsibleIndividual: (p[PV.responsibleIndividual]?.rich_text || [])
      .map(t => t.plain_text).join(''),
    approvedBy: (p[PV.approvedBy]?.rich_text || []).map(t => t.plain_text).join(''),
    claimIds: (p[PV.claims]?.relation || []).map(r => r.id),
    latestVersionOfId: (p[PV.latestVersionOf]?.relation || [])[0]?.id || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Fetch every version page that points back to a given AICS document, sorted
 * by effective date (newest first).
 */
export async function getAicsVersionsForDocument(docId) {
  if (!docId) throw new Error('getAicsVersionsForDocument: docId is required.');
  const res = await notion.databases.query({
    database_id: PCS_DB.aicsVersions,
    filter: { property: PV.aicsDocument, relation: { contains: docId } },
    sorts: [{ property: PV.effectiveDate, direction: 'descending' }],
  });
  return res.results.map(parseAicsVersionPage);
}

// ─── Claims ──────────────────────────────────────────────────────────────

function parseAicsClaimPage(page) {
  const p = page.properties;
  return {
    id: page.id,
    // The Notion title is the Claim ID — the claim's narrative text lives
    // in PC.claimCore (rich_text). Render `claimText` for backward compat
    // by falling through to the rich_text field if the title is empty.
    claimId: p[PC.claimText]?.title?.[0]?.plain_text || '',
    claimText: (p[PC.claimCore]?.rich_text || []).map((t) => t.plain_text).join('') || p[PC.claimText]?.title?.[0]?.plain_text || '',
    claimNo: p[PC.claimNo]?.number ?? null,
    claimStatus: p[PC.claimStatus]?.select?.name || null,
    benefitCategory: p[PC.benefitCategory]?.select?.name || null,
    claimPrefix: (p[PC.claimPrefix]?.rich_text || []).map((t) => t.plain_text).join('') || null,
    aicsDocumentId: (p[PC.aicsDocument]?.relation || [])[0]?.id || null,
    aicsVersionId: (p[PC.aicsVersion]?.relation || [])[0]?.id || null,
    ageGroup: p[PC.ageGroup]?.select?.name || null,
    sex: p[PC.sex]?.select?.name || null,
    lifeStage: (p[PC.lifeStage]?.multi_select || []).map((s) => s.name),
    lifestyleTags: (p[PC.lifestyleTags]?.multi_select || []).map((s) => s.name),
    minDose: p[PC.minDose]?.number ?? null,
    minDoseUnit: p[PC.minDoseUnit]?.select?.name || null,
    minDoseSecondary: p[PC.minDoseSecondary]?.number ?? null,
    minDoseSecondaryUnit: p[PC.minDoseSecondaryUnit]?.select?.name || null,
    grade: p[PC.grade]?.select?.name || null,
    fdaDsheaDisclaimerRequired: p[PC.fdaDsheaDisclaimerRequired]?.checkbox || false,
    // Bundle 3.5 P2 — regulatory metadata.
    substantiatingRefs: (p[PC.substantiatingRefs]?.rich_text || []).map((t) => t.plain_text).join(''),
    regulatoryMonographs: (p[PC.regulatoryMonographs]?.rich_text || []).map((t) => t.plain_text).join(''),
    safetyLimit: p[PC.safetyLimit]?.number ?? null,
    safetyLimitUnit: p[PC.safetyLimitUnit]?.select?.name || null,
    safetyNotes: (p[PC.safetyNotes]?.rich_text || []).map((t) => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Bundle 3.5 P2 — update an AICS Claim's regulatory metadata in place.
 * Allowlists exactly the regulatory fields; everything else stays untouched.
 */
export async function updateAicsClaimRegulatory(claimId, fields) {
  if (!claimId) throw new Error('updateAicsClaimRegulatory: claimId is required.');
  const properties = {};
  if (fields.substantiatingRefs !== undefined) {
    properties[PC.substantiatingRefs] = { rich_text: [{ text: { content: String(fields.substantiatingRefs || '').slice(0, 1900) } }] };
  }
  if (fields.regulatoryMonographs !== undefined) {
    properties[PC.regulatoryMonographs] = { rich_text: [{ text: { content: String(fields.regulatoryMonographs || '').slice(0, 1900) } }] };
  }
  if (fields.safetyLimit !== undefined) {
    properties[PC.safetyLimit] = fields.safetyLimit == null || fields.safetyLimit === '' ? { number: null } : { number: Number(fields.safetyLimit) };
  }
  if (fields.safetyLimitUnit !== undefined) {
    properties[PC.safetyLimitUnit] = fields.safetyLimitUnit ? { select: { name: fields.safetyLimitUnit } } : { select: null };
  }
  if (fields.safetyNotes !== undefined) {
    properties[PC.safetyNotes] = { rich_text: [{ text: { content: String(fields.safetyNotes || '').slice(0, 1900) } }] };
  }
  const page = await notion.pages.update({ page_id: claimId, properties });
  return parseAicsClaimPage(page);
}

/**
 * Fetch every claim attached to a specific AICS version, sorted by claim_no.
 */
export async function getAicsClaimsForVersion(versionId) {
  if (!versionId) throw new Error('getAicsClaimsForVersion: versionId is required.');
  const res = await notion.databases.query({
    database_id: PCS_DB.aicsClaims,
    filter: { property: PC.aicsVersion, relation: { contains: versionId } },
    sorts: [{ property: PC.claimNo, direction: 'ascending' }],
  });
  return res.results.map(parseAicsClaimPage);
}
