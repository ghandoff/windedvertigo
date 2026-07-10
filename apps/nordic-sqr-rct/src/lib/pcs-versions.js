/**
 * PCS Versions CRUD — version snapshots of PCS documents.
 *
 * Each version belongs to a document and contains claims, formula lines,
 * references, and revision events.
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.7 column-name overrides for versions.
// Notion shape uses uppercase abbreviations (EPA, DHA) that the default
// camelCase → snake_case regex would otherwise mangle (totalEPA →
// total_e_p_a). Map these to the actual Postgres column names.
const VERSIONS_PG_COLUMN_MAP = {
  totalEPA: 'total_epa',
  totalDHA: 'total_dha',
  totalEPAandDHA: 'total_epa_and_dha',
};

const P = PROPS.versions;

/**
 * 2026-05-06 — Path-2 Day 2.7. Convert a Postgres pcs_versions row
 * into the same shape parsePage() returns. See pcs-evidence.js for
 * the full pattern rationale.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    version: row.version || '',
    pcsDocumentId: row.pcs_document_id || null,
    effectiveDate: row.effective_date || null,
    isLatest: row.is_latest || false,
    versionNotes: row.version_notes || '',
    supersedesId: row.supersedes_id || null,
    claimIds: row.claim_ids || [],
    formulaLineIds: row.formula_line_ids || [],
    referenceIds: row.reference_ids || [],
    revisionEventIds: row.revision_event_ids || [],
    requestIds: row.request_ids || [],
    latestVersionOfId: row.latest_version_of_id || null,
    productName: row.product_name || '',
    formatOverride: row.format_override || '',
    demographic: row.demographic || [],
    biologicalSex: row.biological_sex || [],
    ageGroup: row.age_group || [],
    lifeStage: row.life_stage || [],
    lifestyle: row.lifestyle || [],
    demographicBackfillReview: row.demographic_backfill_review || '',
    dailyServingSize: row.daily_serving_size || '',
    totalEPA: row.total_epa ?? null,
    totalDHA: row.total_dha ?? null,
    totalEPAandDHA: row.total_epa_and_dha ?? null,
    totalOmega6: row.total_omega6 ?? null,
    totalOmega9: row.total_omega9 ?? null,
    sourceType: row.source_type || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Build the Notion properties payload for Lauren's template fields.
 * Extracted so both createVersion and updateVersion can share it.
 */
function laurenTemplateProps(fields) {
  const out = {};
  if (fields.productName !== undefined) {
    out[P.productName] = { rich_text: [{ text: { content: fields.productName || '' } }] };
  }
  if (fields.formatOverride !== undefined) {
    out[P.formatOverride] = { rich_text: [{ text: { content: fields.formatOverride || '' } }] };
  }
  if (fields.demographic !== undefined) {
    out[P.demographic] = { multi_select: (fields.demographic || []).map(name => ({ name })) };
  }
  // Demographic axes (Wave 4.1a)
  if (fields.biologicalSex !== undefined) {
    out[P.biologicalSex] = { multi_select: (fields.biologicalSex || []).map(name => ({ name })) };
  }
  if (fields.ageGroup !== undefined) {
    out[P.ageGroup] = { multi_select: (fields.ageGroup || []).map(name => ({ name })) };
  }
  if (fields.lifeStage !== undefined) {
    out[P.lifeStage] = { multi_select: (fields.lifeStage || []).map(name => ({ name })) };
  }
  if (fields.lifestyle !== undefined) {
    out[P.lifestyle] = { multi_select: (fields.lifestyle || []).map(name => ({ name })) };
  }
  if (fields.demographicBackfillReview !== undefined) {
    out[P.demographicBackfillReview] = {
      rich_text: [{ text: { content: fields.demographicBackfillReview || '' } }],
    };
  }
  if (fields.dailyServingSize !== undefined) {
    out[P.dailyServingSize] = { rich_text: [{ text: { content: fields.dailyServingSize || '' } }] };
  }
  if (fields.totalEPA !== undefined) out[P.totalEPA] = { number: fields.totalEPA };
  if (fields.totalDHA !== undefined) out[P.totalDHA] = { number: fields.totalDHA };
  if (fields.totalEPAandDHA !== undefined) out[P.totalEPAandDHA] = { number: fields.totalEPAandDHA };
  if (fields.totalOmega6 !== undefined) out[P.totalOmega6] = { number: fields.totalOmega6 };
  if (fields.totalOmega9 !== undefined) out[P.totalOmega9] = { number: fields.totalOmega9 };
  return out;
}

export async function getVersionsForDocument(documentId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_versions')
    .select('*')
    .eq('pcs_document_id', documentId)
    .order('effective_date', { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getVersion(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_versions')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

export async function getAllVersions() {
  return await _fetchAllVersionsFromPostgres();
}

async function _fetchAllVersionsFromPostgres() {
  // 38 rows today; default Supabase limit covers it with headroom.
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_versions')
    .select('*')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function createVersion(fields) {
  const properties = {
    [P.version]: { title: [{ text: { content: fields.version } }] },
  };
  if (fields.pcsDocumentId) {
    properties[P.pcsDocument] = { relation: [{ id: fields.pcsDocumentId }] };
  }
  if (fields.effectiveDate) {
    properties[P.effectiveDate] = { date: { start: fields.effectiveDate } };
  }
  if (fields.isLatest !== undefined) {
    properties[P.isLatest] = { checkbox: fields.isLatest };
  }
  if (fields.versionNotes) {
    properties[P.versionNotes] = { rich_text: [{ text: { content: fields.versionNotes } }] };
  }
  if (fields.supersedesId) {
    properties[P.supersedes] = { relation: [{ id: fields.supersedesId }] };
  }
  if (fields.sourceType) {
    properties[P.sourceType] = { select: { name: fields.sourceType } };
  }
  Object.assign(properties, laurenTemplateProps(fields));

  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      version: fields.version || '',
      pcsDocumentId: fields.pcsDocumentId || null,
      effectiveDate: fields.effectiveDate || null,
      isLatest: fields.isLatest || false,
      versionNotes: fields.versionNotes || '',
      supersedesId: fields.supersedesId || null,
      claimIds: [],
      formulaLineIds: [],
      referenceIds: [],
      revisionEventIds: [],
      requestIds: [],
      latestVersionOfId: fields.latestVersionOfId || null,
      productName: fields.productName || '',
      formatOverride: fields.formatOverride || '',
      demographic: fields.demographic || [],
      biologicalSex: fields.biologicalSex || [],
      ageGroup: fields.ageGroup || [],
      lifeStage: fields.lifeStage || [],
      lifestyle: fields.lifestyle || [],
      demographicBackfillReview: fields.demographicBackfillReview || '',
      dailyServingSize: fields.dailyServingSize || '',
      totalEPA: fields.totalEPA ?? null,
      totalDHA: fields.totalDHA ?? null,
      totalEPAandDHA: fields.totalEPAandDHA ?? null,
      totalOmega6: fields.totalOmega6 ?? null,
      totalOmega9: fields.totalOmega9 ?? null,
      sourceType: fields.sourceType || null,
    };
    await writePostgresFirst('pcs_versions', stubRow, VERSIONS_PG_COLUMN_MAP);
    return stubRow;
  }
}

export async function updateVersion(id, fields) {
  const properties = {};
  if (fields.version !== undefined) {
    properties[P.version] = { title: [{ text: { content: fields.version } }] };
  }
  if (fields.effectiveDate !== undefined) {
    properties[P.effectiveDate] = fields.effectiveDate
      ? { date: { start: fields.effectiveDate } }
      : { date: null };
  }
  if (fields.isLatest !== undefined) {
    properties[P.isLatest] = { checkbox: fields.isLatest };
  }
  if (fields.versionNotes !== undefined) {
    properties[P.versionNotes] = { rich_text: [{ text: { content: fields.versionNotes } }] };
  }
  Object.assign(properties, laurenTemplateProps(fields));
  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...fields };
    await writePostgresFirst('pcs_versions', stubRow, VERSIONS_PG_COLUMN_MAP);
    return stubRow;
  }
}
