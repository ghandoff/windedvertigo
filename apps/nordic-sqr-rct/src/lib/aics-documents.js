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
 *
 * Phase 1 Postgres migration (2026-05-14):
 *   - Adds column maps, feature-flag helpers, syncRecent* + syncSingle*
 *     functions for drift-sync cron + webhook handler.
 *   - All new Postgres paths are gated behind AICS_READ_FROM_POSTGRES /
 *     AICS_WRITE_TO_POSTGRES flags (default OFF). No behavior change.
 *   - Phase 2 will wire shouldReadFromAicsPostgres() into the read paths.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import {
  getPcsSupabase, mirrorToPostgres, shouldUseStrongConsistency,
  writePostgresFirst,
} from './supabase-pcs.js';

const PD = PROPS.aicsDocuments;
const PV = PROPS.aicsVersions;
const PC = PROPS.aicsClaims;

// ─── Postgres column-name overrides ──────────────────────────────────────
//
// Most camelCase fields follow the mechanical camelCase → snake_case rule
// applied by notionShapeToPgRow in supabase-pcs.js. List only the fields
// that deviate from that rule.

const AICS_DOCUMENTS_PG_COLUMN_MAP = {
  // ai_name_text deviates from mechanical camelCase→snake_case ('ai_name')
  // because the table also has an active_ingredient_id UUID FK; the _text
  // suffix distinguishes the free-text fallback column from the relational one.
  aiName: 'ai_name_text',
};

const AICS_VERSIONS_PG_COLUMN_MAP = {};

const AICS_CLAIMS_PG_COLUMN_MAP = {
  // fdaDsheaDisclaimerRequired: regex produces fda_d_s_h_e_a_disclaimer_required, schema wants fda_dshea_disclaimer_required
  fdaDsheaDisclaimerRequired: 'fda_dshea_disclaimer_required',
  // claimPrefix text field maps to claim_prefix_text column
  claimPrefix: 'claim_prefix_text',
};

// ─── Feature-flag helpers ─────────────────────────────────────────────────

/**
 * True when the AICS read-from-Postgres flag is on AND the Supabase client is
 * configured. Set `AICS_READ_FROM_POSTGRES=1` in Vercel to enable.
 */
export function shouldReadFromAicsPostgres() {
  const flag = process.env.AICS_READ_FROM_POSTGRES;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

/**
 * True when the AICS write-to-Postgres-first flag is on AND the Supabase
 * client is configured. Set `AICS_WRITE_TO_POSTGRES=1` in Vercel to enable.
 */
export function shouldWriteToAicsPostgresFirst() {
  const flag = process.env.AICS_WRITE_TO_POSTGRES;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

// ─── Postgres row parsers (Phase 2 read path) ────────────────────────────
//
// Each function converts a raw Supabase row back into the SAME shape the
// corresponding parse*Page function produces, so callers cannot tell whether
// data came from Notion or Postgres.
//
// Field-mapping conventions (mirror pcs-evidence.js parsePostgresRow):
//   - notion_page_id        → id          (canonical Notion ID used by callers)
//   - notion_last_edited_at → lastEditedTime
//   - notion_created_at     → createdTime
//   - All other columns:    snake_case → camelCase
//   - Arrays / booleans / numbers / nulls: passed through as-is.
//
// Special cases documented inline.

/**
 * Convert a raw `aics_documents` Postgres row into the parseAicsDocumentPage shape.
 */
function parsePostgresAicsDocumentRow(row) {
  return {
    id: row.notion_page_id,
    aicsId: row.aics_id || '',
    aiName: row.ai_name_text || '',
    classification: row.classification || null,
    fileStatus: row.file_status || null,
    raReviewStatus: row.ra_review_status || null,
    documentNotes: row.document_notes || '',
    approvedDate: row.approved_date || null,
    latestVersionId: row.latest_version_id || null,
    allVersionIds: row.all_version_ids || [],
    archived: row.archived || false,
    templateVersion: row.template_version || null,
    templateSignals: row.template_signals || '',
    demographic: row.demographic || null,
    assignedReviewerIds: row.assigned_reviewer_ids || [],
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Convert a raw `aics_versions` Postgres row into the parseAicsVersionPage shape.
 *
 * aicsDocumentId: comes from aics_document_notion_id (TEXT column added in 003
 * as a parallel to the UUID FK), matching the notion_page_id the Notion path
 * returns for the relation property.
 *
 * latestVersionOfId: stored as latest_version_of_id (TEXT, added in 005).
 * claimIds: stored as claim_ids (TEXT[], added in 005).
 */
function parsePostgresAicsVersionRow(row) {
  return {
    id: row.notion_page_id,
    version: row.version || '',
    aicsDocumentId: row.aics_document_notion_id || null,
    isLatest: row.is_latest || false,
    effectiveDate: row.effective_date || null,
    changeDescription: row.change_description || '',
    responsibleDept: row.responsible_dept || null,
    responsibleIndividual: row.responsible_individual || '',
    approvedBy: row.approved_by || '',
    claimIds: row.claim_ids || [],
    latestVersionOfId: row.latest_version_of_id || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Convert a raw `aics_claims` Postgres row into the parseAicsClaimPage shape.
 *
 * claimPrefix: stored as claim_prefix_text (via AICS_CLAIMS_PG_COLUMN_MAP override).
 * fdaDsheaDisclaimerRequired: stored as fda_dshea_disclaimer_required.
 *
 * aicsDocumentId / aicsVersionId: aics_claims stores UUID FKs, not notion_page_ids,
 * for these two back-relations. They are returned as-is (UUID strings) which differs
 * from the Notion path (notion_page_ids). In practice these fields are display-only in
 * current callers and are not used for further Notion round-trips; the UUID values are
 * stable identifiers for the same semantic entities. A future backfill migration can add
 * aics_document_notion_id / aics_version_notion_id text columns to aics_claims if
 * strict parity becomes necessary.
 */
function parsePostgresAicsClaimRow(row) {
  return {
    id: row.notion_page_id,
    claimId: row.claim_id || '',
    claimText: row.claim_text || '',
    claimNo: row.claim_no ?? null,
    claimStatus: row.claim_status || null,
    benefitCategory: row.benefit_category || null,
    claimPrefix: row.claim_prefix_text || null,
    aicsDocumentId: row.aics_document_id || null,
    aicsVersionId: row.aics_version_id || null,
    ageGroup: row.age_group_code || null,
    sex: row.sex_code || null,
    lifeStage: row.life_stage || [],
    lifestyleTags: row.lifestyle_tags || [],
    minDose: row.min_dose ?? null,
    minDoseUnit: row.min_dose_unit || null,
    minDoseSecondary: row.min_dose_secondary ?? null,
    minDoseSecondaryUnit: row.min_dose_secondary_unit || null,
    grade: row.grade || null,
    fdaDsheaDisclaimerRequired: row.fda_dshea_disclaimer_required || false,
    substantiatingRefs: row.substantiating_refs || '',
    regulatoryMonographs: row.regulatory_monographs || '',
    safetyLimit: row.safety_limit ?? null,
    safetyLimitUnit: row.safety_limit_unit || null,
    safetyNotes: row.safety_notes || '',
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

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
    demographic: p[PD.demographic]?.select?.name || null,
    assignedReviewerIds: (p[PD.assignedReviewers]?.relation || []).map(r => r.id),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Fetch a single AICS document by its Notion page id.
 * Phase 2: tries Postgres first when shouldReadFromAicsPostgres() is active;
 * falls back to Notion on any error or missing row.
 */
export async function getAicsDocument(id) {
  if (shouldReadFromAicsPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('aics_documents')
        .select('*')
        .eq('notion_page_id', id)
        .maybeSingle();
      if (error) throw error;
      if (data) return parsePostgresAicsDocumentRow(data);
      // Row missing in Postgres — could be newly created in Notion since last sync.
      // Fall through to Notion.
    } catch (err) {
      console.warn(`[aics-documents] Postgres getAicsDocument failed, falling back to Notion: ${err.message}`);
    }
  }
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
export async function listAicsDocuments({ limit = 100, cursor, status, demographic, assignedReviewerId } = {}) {
  // Phase 2: try Postgres first when the flag is on. Postgres doesn't support
  // Notion-style cursors; the full result set is returned up to `limit` rows
  // sorted by aics_id. Falls back to Notion on any error.
  if (shouldReadFromAicsPostgres()) {
    try {
      const sb = getPcsSupabase();
      let q = sb
        .from('aics_documents')
        .select('*')
        .order('aics_id', { ascending: true })
        .limit(Math.min(limit, 1000));
      if (status) q = q.eq('ra_review_status', status);
      if (demographic) q = q.eq('demographic', demographic);
      if (assignedReviewerId) q = q.contains('assigned_reviewer_ids', [assignedReviewerId]);
      const { data, error } = await q;
      if (error) throw error;
      return {
        items: (data || []).map(parsePostgresAicsDocumentRow),
        nextCursor: null,
      };
    } catch (err) {
      console.warn(`[aics-documents] Postgres listAicsDocuments failed, falling back to Notion: ${err.message}`);
    }
  }

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

  // Build compound filter for status + demographic
  const filters = [];
  if (status) filters.push({ property: PD.raReviewStatus, select: { equals: status } });
  if (demographic) filters.push({ property: PD.demographic, select: { equals: demographic } });
  if (filters.length === 1) query.filter = filters[0];
  if (filters.length > 1) query.filter = { and: filters };

  const res = await notion.databases.query(query);
  let items = res.results.map(parseAicsDocumentPage);

  // Contractor scoping: filter in JS since Notion multi-relation filter
  // requires the exact page id which is available post-parse.
  if (assignedReviewerId) {
    items = items.filter(d => d.assignedReviewerIds.includes(assignedReviewerId));
  }

  return {
    items,
    nextCursor: res.has_more ? res.next_cursor : null,
  };
}

/**
 * Resolve an AICS document by canonical ingredient name.
 *
 * Matching priority:
 *   1. Exact match (case-insensitive) on aiName
 *   2. Substring match in either direction (e.g. "Vitamin D3" matches "Vitamin D3 (Cholecalciferol)")
 *
 * When multiple AICS documents cover the same ingredient at different
 * demographics (e.g. "Vitamin D Adults" vs "Vitamin D Babies"), ALL matches
 * are returned so the caller can pick the right one by demographic.
 *
 * @param {string} ingredientName — canonical ingredient name from pcs_ingredients
 * @param {{ raReviewStatus?: string }} [opts]
 * @returns {Promise<Array>} — matched AICS document objects, may be empty
 */
export async function getAicsDocumentsByIngredientName(ingredientName, opts = {}) {
  if (!ingredientName) return [];
  const { items } = await listAicsDocuments({ limit: 500, status: opts.raReviewStatus });
  const needle = ingredientName.trim().toLowerCase();
  return items.filter(doc => {
    const hay = (doc.aiName || '').trim().toLowerCase();
    if (!hay) return false;
    // Exact or substring match in either direction
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
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
  if (!PCS_DB.aicsDocuments) throw new Error('createAicsDocument: PCS_DB.aicsDocuments is not configured (set NOTION_AICS_DOCUMENTS_DB).');
  const properties = aicsDocumentProps(fields);

  if (shouldWriteToAicsPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      aicsId: fields.aicsId || '',
      aiName: fields.aiName || '',
      classification: fields.classification || null,
      fileStatus: fields.fileStatus || null,
      raReviewStatus: fields.raReviewStatus || null,
      documentNotes: fields.documentNotes || '',
      approvedDate: fields.approvedDate || null,
      latestVersionId: fields.latestVersionId || null,
      allVersionIds: fields.allVersionIds || [],
      archived: fields.archived || false,
      templateVersion: fields.templateVersion || null,
      templateSignals: fields.templateSignals || '',
    };
    return writePostgresFirst(
      'aics_documents',
      stubRow,
      AICS_DOCUMENTS_PG_COLUMN_MAP,
      () => notion.pages.create({ parent: { database_id: PCS_DB.aicsDocuments }, properties }),
    );
  }

  // Notion-only path (unchanged)
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.aicsDocuments },
    properties,
  });
  const parsed = parseAicsDocumentPage(page);
  await mirrorToPostgres('aics_documents', parsed, AICS_DOCUMENTS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
  return parsed;
}

/**
 * Patch an AICS document. Only fields present in `patch` are written.
 */
export async function updateAicsDocument(id, patch) {
  if (!id) throw new Error('updateAicsDocument: id is required.');
  const properties = aicsDocumentProps(patch || {});

  if (shouldWriteToAicsPostgresFirst()) {
    const stubRow = { id, ...(patch || {}) };
    return writePostgresFirst(
      'aics_documents',
      stubRow,
      AICS_DOCUMENTS_PG_COLUMN_MAP,
      () => notion.pages.update({ page_id: id, properties }),
    );
  }

  // Notion-only path (unchanged)
  const page = await notion.pages.update({ page_id: id, properties });
  const parsed = parseAicsDocumentPage(page);
  await mirrorToPostgres('aics_documents', parsed, AICS_DOCUMENTS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
  return parsed;
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
 *
 * Phase 2: tries Postgres first when shouldReadFromAicsPostgres() is active.
 * aics_versions stores the document's notion_page_id in aics_document_notion_id
 * (TEXT column, 003 DDL), so we can filter without a join.
 */
export async function getAicsVersionsForDocument(docId) {
  if (!docId) throw new Error('getAicsVersionsForDocument: docId is required.');

  if (shouldReadFromAicsPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('aics_versions')
        .select('*')
        .eq('aics_document_notion_id', docId)
        .order('effective_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []).map(parsePostgresAicsVersionRow);
    } catch (err) {
      console.warn(`[aics-documents] Postgres getAicsVersionsForDocument failed, falling back to Notion: ${err.message}`);
    }
  }

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

  if (shouldWriteToAicsPostgresFirst()) {
    const stubRow = { id: claimId, ...fields };
    return writePostgresFirst(
      'aics_claims',
      stubRow,
      AICS_CLAIMS_PG_COLUMN_MAP,
      () => notion.pages.update({ page_id: claimId, properties }),
    );
  }

  // Notion-only path (unchanged)
  const page = await notion.pages.update({ page_id: claimId, properties });
  const parsed = parseAicsClaimPage(page);
  await mirrorToPostgres('aics_claims', parsed, AICS_CLAIMS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
  return parsed;
}

/**
 * Fetch every claim attached to a specific AICS version, sorted by claim_no.
 *
 * Phase 2: tries Postgres first when shouldReadFromAicsPostgres() is active.
 * aics_claims stores aics_version_id as a UUID FK; we first resolve the UUID
 * by looking up aics_versions by notion_page_id, then filter claims by that UUID.
 * Both round-trips are against Postgres and are fast indexed lookups.
 */
export async function getAicsClaimsForVersion(versionId) {
  if (!versionId) throw new Error('getAicsClaimsForVersion: versionId is required.');

  if (shouldReadFromAicsPostgres()) {
    try {
      const sb = getPcsSupabase();
      // Step 1: resolve the Postgres UUID for this version's notion_page_id.
      const { data: versionRow, error: vErr } = await sb
        .from('aics_versions')
        .select('id')
        .eq('notion_page_id', versionId)
        .maybeSingle();
      if (vErr) throw vErr;
      if (versionRow) {
        // Step 2: fetch claims by the resolved UUID FK.
        const { data, error } = await sb
          .from('aics_claims')
          .select('*')
          .eq('aics_version_id', versionRow.id)
          .order('claim_no', { ascending: true, nullsFirst: false });
        if (error) throw error;
        return (data || []).map(parsePostgresAicsClaimRow);
      }
      // Version row not in Postgres yet — fall through to Notion.
    } catch (err) {
      console.warn(`[aics-documents] Postgres getAicsClaimsForVersion failed, falling back to Notion: ${err.message}`);
    }
  }

  const res = await notion.databases.query({
    database_id: PCS_DB.aicsClaims,
    filter: { property: PC.aicsVersion, relation: { contains: versionId } },
    sorts: [{ property: PC.claimNo, direction: 'ascending' }],
  });
  return res.results.map(parseAicsClaimPage);
}

// ─── Create helpers ───────────────────────────────────────────────────────

/**
 * Create an AICS Version page and relate it to its parent AICS document.
 *
 * @param {string} docId   — Notion page_id of the parent AICS document.
 * @param {object} fields
 * @param {string}  fields.version              — required; Notion title (PV.version)
 * @param {string}  [fields.effectiveDate]      — ISO date string 'YYYY-MM-DD'
 * @param {string}  [fields.changeDescription]
 * @param {string}  [fields.responsibleDept]
 * @param {string}  [fields.responsibleIndividual]
 * @param {string}  [fields.approvedBy]
 * @param {boolean} [fields.isLatest]
 */
export async function createAicsVersion(docId, fields) {
  if (!docId) throw new Error('createAicsVersion: docId is required.');
  if (!fields?.version) throw new Error('createAicsVersion: fields.version is required.');
  if (!PCS_DB.aicsVersions) throw new Error('createAicsVersion: PCS_DB.aicsVersions is not configured (set NOTION_AICS_VERSIONS_DB).');

  const properties = {};
  properties[PV.version] = { title: [{ text: { content: fields.version } }] };
  properties[PV.aicsDocument] = { relation: [{ id: docId }] };
  if (fields.isLatest !== undefined) {
    properties[PV.isLatest] = { checkbox: !!fields.isLatest };
  }
  if (fields.effectiveDate !== undefined) {
    properties[PV.effectiveDate] = fields.effectiveDate
      ? { date: { start: fields.effectiveDate } }
      : { date: null };
  }
  if (fields.changeDescription !== undefined) {
    properties[PV.changeDescription] = { rich_text: [{ text: { content: fields.changeDescription || '' } }] };
  }
  if (fields.responsibleDept !== undefined) {
    properties[PV.responsibleDept] = fields.responsibleDept
      ? { select: { name: fields.responsibleDept } }
      : { select: null };
  }
  if (fields.responsibleIndividual !== undefined) {
    properties[PV.responsibleIndividual] = { rich_text: [{ text: { content: fields.responsibleIndividual || '' } }] };
  }
  if (fields.approvedBy !== undefined) {
    properties[PV.approvedBy] = { rich_text: [{ text: { content: fields.approvedBy || '' } }] };
  }

  if (shouldWriteToAicsPostgresFirst()) {
    const preId = crypto.randomUUID();

    // The FK column aics_document_id references aics_documents.id (Postgres UUID),
    // not the Notion page ID that callers pass as docId. Look up the UUID first.
    let pgDocId = null;
    let pgDocNotionId = docId;
    try {
      const sb = await getPcsSupabase();
      const { data } = await sb
        .from('aics_documents')
        .select('id')
        .eq('notion_page_id', docId)
        .maybeSingle();
      pgDocId = data?.id || null;
    } catch { /* pgDocId stays null — FK insert will surface the error clearly */ }

    const stubRow = {
      id: preId,
      version: fields.version,
      aicsDocumentId: pgDocId,        // UUID FK → aics_documents.id
      aicsDocumentNotionId: pgDocNotionId, // TEXT column for Notion page ID
      isLatest: fields.isLatest || false,
      effectiveDate: fields.effectiveDate || null,
      changeDescription: fields.changeDescription || '',
      responsibleDept: fields.responsibleDept || null,
      responsibleIndividual: fields.responsibleIndividual || '',
      approvedBy: fields.approvedBy || '',
    };
    return writePostgresFirst(
      'aics_versions',
      stubRow,
      AICS_VERSIONS_PG_COLUMN_MAP,
      () => notion.pages.create({ parent: { database_id: PCS_DB.aicsVersions }, properties }),
    );
  }

  // Notion-only path
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.aicsVersions },
    properties,
  });
  const parsed = parseAicsVersionPage(page);
  await mirrorToPostgres('aics_versions', parsed, AICS_VERSIONS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
  return parsed;
}

/**
 * Create an AICS Claim page and relate it to both its parent AICS document
 * and the specific AICS version it belongs to.
 *
 * @param {string} docId      — Notion page_id of the parent AICS document.
 * @param {string} versionId  — Notion page_id of the parent AICS version.
 * @param {object} fields
 * @param {string}   fields.claimId                      — required; Notion title (PC.claimText)
 * @param {string}   [fields.claimText]                  — narrative claim body (PC.claimCore)
 * @param {number}   [fields.claimNo]
 * @param {string}   [fields.benefitCategory]
 * @param {string}   [fields.ageGroup]
 * @param {string}   [fields.sex]
 * @param {number}   [fields.minDose]
 * @param {string}   [fields.minDoseUnit]
 * @param {string}   [fields.grade]
 * @param {string[]} [fields.lifeStage]
 * @param {string[]} [fields.lifestyleTags]
 * @param {boolean}  [fields.fdaDsheaDisclaimerRequired]
 * @param {string}   [fields.claimPrefix]
 * @param {string}   [fields.claimStatus]
 */
export async function createAicsClaim(docId, versionId, fields) {
  if (!docId) throw new Error('createAicsClaim: docId is required.');
  if (!versionId) throw new Error('createAicsClaim: versionId is required.');
  if (!fields?.claimId) throw new Error('createAicsClaim: fields.claimId is required.');
  if (!PCS_DB.aicsClaims) throw new Error('createAicsClaim: PCS_DB.aicsClaims is not configured (set NOTION_AICS_CLAIMS_DB).');

  const properties = {};
  properties[PC.claimText] = { title: [{ text: { content: fields.claimId } }] };
  properties[PC.aicsDocument] = { relation: [{ id: docId }] };
  properties[PC.aicsVersion] = { relation: [{ id: versionId }] };

  if (fields.claimText !== undefined) {
    properties[PC.claimCore] = { rich_text: [{ text: { content: fields.claimText || '' } }] };
  }
  if (fields.claimNo !== undefined) {
    properties[PC.claimNo] = fields.claimNo == null ? { number: null } : { number: Number(fields.claimNo) };
  }
  if (fields.benefitCategory !== undefined) {
    properties[PC.benefitCategory] = fields.benefitCategory
      ? { select: { name: fields.benefitCategory } }
      : { select: null };
  }
  if (fields.ageGroup !== undefined) {
    properties[PC.ageGroup] = fields.ageGroup
      ? { select: { name: fields.ageGroup } }
      : { select: null };
  }
  if (fields.sex !== undefined) {
    properties[PC.sex] = fields.sex
      ? { select: { name: fields.sex } }
      : { select: null };
  }
  if (fields.minDose !== undefined) {
    properties[PC.minDose] = fields.minDose == null ? { number: null } : { number: Number(fields.minDose) };
  }
  if (fields.minDoseUnit !== undefined) {
    properties[PC.minDoseUnit] = fields.minDoseUnit
      ? { select: { name: fields.minDoseUnit } }
      : { select: null };
  }
  if (fields.grade !== undefined) {
    properties[PC.grade] = fields.grade
      ? { select: { name: fields.grade } }
      : { select: null };
  }
  if (fields.lifeStage !== undefined) {
    properties[PC.lifeStage] = { multi_select: (fields.lifeStage || []).map((name) => ({ name })) };
  }
  if (fields.lifestyleTags !== undefined) {
    properties[PC.lifestyleTags] = { multi_select: (fields.lifestyleTags || []).map((name) => ({ name })) };
  }
  if (fields.fdaDsheaDisclaimerRequired !== undefined) {
    properties[PC.fdaDsheaDisclaimerRequired] = { checkbox: !!fields.fdaDsheaDisclaimerRequired };
  }
  if (fields.claimPrefix !== undefined) {
    properties[PC.claimPrefix] = { rich_text: [{ text: { content: fields.claimPrefix || '' } }] };
  }
  if (fields.claimStatus !== undefined) {
    properties[PC.claimStatus] = fields.claimStatus
      ? { select: { name: fields.claimStatus } }
      : { select: null };
  }

  if (shouldWriteToAicsPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      claimId: fields.claimId,
      claimText: fields.claimText || '',
      claimNo: fields.claimNo ?? null,
      benefitCategory: fields.benefitCategory || null,
      ageGroup: fields.ageGroup || null,
      sex: fields.sex || null,
      minDose: fields.minDose ?? null,
      minDoseUnit: fields.minDoseUnit || null,
      grade: fields.grade || null,
      lifeStage: fields.lifeStage || [],
      lifestyleTags: fields.lifestyleTags || [],
      fdaDsheaDisclaimerRequired: fields.fdaDsheaDisclaimerRequired || false,
      aicsDocumentId: docId,
      aicsVersionId: versionId,
    };
    return writePostgresFirst(
      'aics_claims',
      stubRow,
      AICS_CLAIMS_PG_COLUMN_MAP,
      () => notion.pages.create({ parent: { database_id: PCS_DB.aicsClaims }, properties }),
    );
  }

  // Notion-only path
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.aicsClaims },
    properties,
  });
  const parsed = parseAicsClaimPage(page);
  await mirrorToPostgres('aics_claims', parsed, AICS_CLAIMS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
  return parsed;
}
