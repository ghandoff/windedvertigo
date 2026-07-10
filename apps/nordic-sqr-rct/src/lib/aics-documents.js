/**
 * AICS Documents / Versions / Claims CRUD — upstream sibling of PCS.
 *
 * AICS = Active Ingredient Claims Substantiation. Where a PCS doc lives at
 * the product level (e.g. "Vit D3 Children's Gummy"), an AICS doc lives at
 * the active-ingredient level (e.g. "Vit D3"). One AICS feeds many PCS docs
 * by reference (see `pcs_aics_references` in 003_aics_entity_ddl.sql).
 *
 * Postgres-only. Reads come straight from the Supabase mirror tables defined
 * in `db/migrations/003_aics_entity_ddl.sql`; writes go through
 * `writePostgresFirst`, gated on the AICS write flag. The former Notion legs
 * (write-through + drift-mirror) were removed once the Postgres path became
 * authoritative — same transformation already applied to `pcs-documents.js`.
 */

import {
  getPcsSupabase, shouldWriteToPostgresFirst, writePostgresFirst,
} from './supabase-pcs.js';

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

// ─── Postgres row parsers ────────────────────────────────────────────────
//
// Each function converts a raw Supabase row into the JS shape callers expect.
//
// Field-mapping conventions (mirror pcs-evidence.js parsePostgresRow):
//   - notion_page_id        → id          (canonical ID used by callers)
//   - notion_last_edited_at → lastEditedTime
//   - notion_created_at     → createdTime
//   - All other columns:    snake_case → camelCase
//   - Arrays / booleans / numbers / nulls: passed through as-is.
//
// Special cases documented inline.

/**
 * Convert a raw `aics_documents` Postgres row into the AICS-document shape.
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
 * Convert a raw `aics_versions` Postgres row into the AICS-version shape.
 *
 * aicsDocumentId: comes from aics_document_notion_id (TEXT column added in 003
 * as a parallel to the UUID FK), matching the notion_page_id used for the
 * relation.
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
 * Convert a raw `aics_claims` Postgres row into the AICS-claim shape.
 *
 * claimPrefix: stored as claim_prefix_text (via AICS_CLAIMS_PG_COLUMN_MAP override).
 * fdaDsheaDisclaimerRequired: stored as fda_dshea_disclaimer_required.
 *
 * aicsDocumentId / aicsVersionId: aics_claims stores UUID FKs for these two
 * back-relations; they are returned as-is (UUID strings). In practice these
 * fields are display-only in current callers and are not used for further
 * round-trips; the UUID values are stable identifiers for the same semantic
 * entities.
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

/**
 * Fetch a single AICS document by its Notion page id.
 */
export async function getAicsDocument(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('aics_documents')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresAicsDocumentRow(data) : null;
}

/**
 * Paginated list of AICS documents. Honors an optional `status` filter
 * (matched against `ra_review_status`) so the sidebar's "Pending RA Review"
 * link can `?status=Pending RA Review` directly into the same endpoint.
 *
 * Postgres doesn't use Notion-style cursors; the full result set is returned
 * up to `limit` rows sorted by aics_id, with nextCursor always null.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=100]
 * @param {string} [opts.cursor]   accepted for signature compatibility; unused
 * @param {string} [opts.status]   exact match on raReviewStatus (e.g. 'Pending RA Review')
 */
export async function listAicsDocuments({ limit = 100, cursor, status, demographic, assignedReviewerId } = {}) {
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
 * Create an AICS document. `aicsId` is the only required field.
 */
export async function createAicsDocument(fields) {
  if (!fields?.aicsId) throw new Error('createAicsDocument: aicsId is required.');

  if (shouldWriteToPostgresFirst()) {
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
    return writePostgresFirst('aics_documents', stubRow, AICS_DOCUMENTS_PG_COLUMN_MAP);
  }
}

/**
 * Patch an AICS document. Only fields present in `patch` are written.
 */
export async function updateAicsDocument(id, patch) {
  if (!id) throw new Error('updateAicsDocument: id is required.');

  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...(patch || {}) };
    return writePostgresFirst('aics_documents', stubRow, AICS_DOCUMENTS_PG_COLUMN_MAP);
  }
}

// ─── Versions ────────────────────────────────────────────────────────────

/**
 * Fetch every version page that points back to a given AICS document, sorted
 * by effective date (newest first).
 *
 * aics_versions stores the document's notion_page_id in aics_document_notion_id
 * (TEXT column, 003 DDL), so we can filter without a join.
 */
export async function getAicsVersionsForDocument(docId) {
  if (!docId) throw new Error('getAicsVersionsForDocument: docId is required.');

  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('aics_versions')
    .select('*')
    .eq('aics_document_notion_id', docId)
    .order('effective_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []).map(parsePostgresAicsVersionRow);
}

// ─── Claims ──────────────────────────────────────────────────────────────

/**
 * Bundle 3.5 P2 — update an AICS Claim's regulatory metadata in place.
 * Allowlists exactly the regulatory fields; everything else stays untouched.
 */
export async function updateAicsClaimRegulatory(claimId, fields) {
  if (!claimId) throw new Error('updateAicsClaimRegulatory: claimId is required.');

  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id: claimId, ...fields };
    return writePostgresFirst('aics_claims', stubRow, AICS_CLAIMS_PG_COLUMN_MAP);
  }
}

/**
 * Fetch every claim attached to a specific AICS version, sorted by claim_no.
 *
 * aics_claims stores aics_version_id as a UUID FK; we first resolve the UUID
 * by looking up aics_versions by notion_page_id, then filter claims by that UUID.
 * Both round-trips are against Postgres and are fast indexed lookups.
 */
export async function getAicsClaimsForVersion(versionId) {
  if (!versionId) throw new Error('getAicsClaimsForVersion: versionId is required.');

  const sb = getPcsSupabase();
  // Step 1: resolve the Postgres UUID for this version's notion_page_id.
  const { data: versionRow, error: vErr } = await sb
    .from('aics_versions')
    .select('id')
    .eq('notion_page_id', versionId)
    .maybeSingle();
  if (vErr) throw vErr;
  if (!versionRow) return [];
  // Step 2: fetch claims by the resolved UUID FK.
  const { data, error } = await sb
    .from('aics_claims')
    .select('*')
    .eq('aics_version_id', versionRow.id)
    .order('claim_no', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map(parsePostgresAicsClaimRow);
}

// ─── Create helpers ───────────────────────────────────────────────────────

/**
 * Create an AICS Version and relate it to its parent AICS document.
 *
 * @param {string} docId   — Notion page_id of the parent AICS document.
 * @param {object} fields
 * @param {string}  fields.version              — required
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

  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();

    // The FK column aics_document_id references aics_documents.id (Postgres UUID),
    // not the Notion page ID that callers pass as docId. Look up the UUID first.
    let pgDocId = null;
    const pgDocNotionId = docId;
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
    return writePostgresFirst('aics_versions', stubRow, AICS_VERSIONS_PG_COLUMN_MAP);
  }
}

/**
 * Create an AICS Claim and relate it to both its parent AICS document
 * and the specific AICS version it belongs to.
 *
 * @param {string} docId      — Notion page_id of the parent AICS document.
 * @param {string} versionId  — Notion page_id of the parent AICS version.
 * @param {object} fields
 * @param {string}   fields.claimId                      — required
 * @param {string}   [fields.claimText]                  — narrative claim body
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

  if (shouldWriteToPostgresFirst()) {
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
    return writePostgresFirst('aics_claims', stubRow, AICS_CLAIMS_PG_COLUMN_MAP);
  }
}
