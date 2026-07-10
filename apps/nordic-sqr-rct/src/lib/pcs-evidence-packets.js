/**
 * PCS Evidence Packets CRUD — junction table linking Claims to Evidence items.
 *
 * Each packet represents one claim ↔ evidence linkage with an evidence role
 * (structure-function vs mechanistic) and SQR-RCT threshold tracking.
 */

import { PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { mutate } from './pcs-mutate.js';
import { getPcsSupabase, writePostgresFirst } from './supabase-pcs.js';


const P = PROPS.evidencePackets;

// 2026-05-06 — column-name overrides for evidence-packets' Notion → Postgres
// mirror. The camelCase → snake_case regex in notionShapeToPgRow() converts
// each uppercase letter independently, so `studyDoseAI` → `study_dose_a_i`
// (both A and I prefixed by _). The schema column is `study_dose_ai` (no
// underscore before the `i`), so we override it explicitly here.
// Without this override every upsert that includes a non-empty studyDoseAI
// value fails with "column study_dose_a_i not found".
const EVIDENCE_PACKETS_PG_COLUMN_MAP = {
  studyDoseAI: 'study_dose_ai',
};

/**
 * 2026-05-06 — Path-2 read-path swap. Convert a Postgres
 * pcs_evidence_packets row into the SAME shape parsePage(notionPage)
 * returns. Field-by-field; defaults match parsePage exactly so callers
 * cannot tell the data came from Postgres.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    name: row.name || '',
    pcsClaimId: row.pcs_claim_id || null,
    evidenceItemId: row.evidence_item_id || null,
    evidenceRole: row.evidence_role || null,
    meetsSqrThreshold: row.meets_sqr_threshold || false,
    relevanceNote: row.relevance_note || '',
    sortOrder: row.sort_order ?? null,
    substantiationTier: row.substantiation_tier || null,
    studyDoseAI: row.study_dose_ai || '',
    studyDoseAmount: row.study_dose_amount ?? null,
    studyDoseUnit: row.study_dose_unit || null,
    nullResultRationale: row.null_result_rationale || '',
    keyTakeaway: row.key_takeaway || '',
    studyDesignSummary: row.study_design_summary || '',
    sampleSize: row.sample_size ?? null,
    positiveResults: row.positive_results || '',
    neutralResults: row.neutral_results || '',
    negativeResults: row.negative_results || '',
    potentialBiases: row.potential_biases || '',
    confidence: row.confidence ?? null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Build Notion properties payload for Lauren's template fields on Evidence Packets.
 * Sparse update — only touches keys explicitly present in `fields`.
 */
function laurenTemplateProps(fields) {
  const out = {};
  if (fields.substantiationTier !== undefined) {
    out[P.substantiationTier] = fields.substantiationTier
      ? { select: { name: fields.substantiationTier } }
      : { select: null };
  }
  if (fields.studyDoseAI !== undefined) {
    out[P.studyDoseAI] = { rich_text: [{ text: { content: fields.studyDoseAI || '' } }] };
  }
  if (fields.studyDoseAmount !== undefined) {
    out[P.studyDoseAmount] = { number: fields.studyDoseAmount };
  }
  if (fields.studyDoseUnit !== undefined) {
    out[P.studyDoseUnit] = fields.studyDoseUnit
      ? { select: { name: fields.studyDoseUnit } }
      : { select: null };
  }
  if (fields.nullResultRationale !== undefined) {
    out[P.nullResultRationale] = { rich_text: [{ text: { content: fields.nullResultRationale || '' } }] };
  }
  if (fields.keyTakeaway !== undefined) {
    out[P.keyTakeaway] = { rich_text: [{ text: { content: fields.keyTakeaway || '' } }] };
  }
  if (fields.studyDesignSummary !== undefined) {
    out[P.studyDesignSummary] = { rich_text: [{ text: { content: fields.studyDesignSummary || '' } }] };
  }
  if (fields.sampleSize !== undefined) {
    out[P.sampleSize] = { number: fields.sampleSize };
  }
  if (fields.positiveResults !== undefined) {
    out[P.positiveResults] = { rich_text: [{ text: { content: fields.positiveResults || '' } }] };
  }
  if (fields.neutralResults !== undefined) {
    out[P.neutralResults] = { rich_text: [{ text: { content: fields.neutralResults || '' } }] };
  }
  if (fields.negativeResults !== undefined) {
    out[P.negativeResults] = { rich_text: [{ text: { content: fields.negativeResults || '' } }] };
  }
  if (fields.potentialBiases !== undefined) {
    out[P.potentialBiases] = { rich_text: [{ text: { content: fields.potentialBiases || '' } }] };
  }
  // Wave 4.5.5 — extractor confidence. Explicit null clears; undefined skips.
  if (fields.confidence !== undefined) {
    out[P.confidence] = { number: fields.confidence };
  }
  return out;
}

export async function getPacketsForClaim(claimId) {
  // 2026-05-06 — Path-2 read-path swap. pcs_claim_id is a TEXT column
  // holding the related claim's notion_page_id. Postgres returns rows
  // unsorted; we sort in-memory to match Notion's ascending-by-sortOrder
  // ordering (nulls last to match Notion's behavior).
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence_packets')
    .select('*')
    .eq('pcs_claim_id', claimId)
    .order('sort_order', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getPacketsForEvidenceItem(evidenceItemId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence_packets')
    .select('*')
    .eq('evidence_item_id', evidenceItemId);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getAllEvidencePackets(maxPages = 50) {
  return _fetchAllEvidencePackets(maxPages);
}

async function _fetchAllEvidencePackets(maxPages) {
  // 2026-05-06 — Path-2 read-path swap. Biggest impact swap: Notion
  // pagination across ~1,783 rows required 18 batches of 100 (17–25s
  // cold). Postgres returns the lot in a single ~50ms SELECT.
  return await _fetchAllEvidencePacketsFromPostgres();
}

async function _fetchAllEvidencePacketsFromPostgres() {
  // Single round-trip. Default Supabase row limit is 1000, so we set
  // an explicit limit well above the current row count (1,783) — bump
  // when the table grows past ~4,500. No sort applied: matches Notion's
  // default (unsorted) ordering for the same call.
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence_packets')
    .select('*')
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getEvidencePacket(id) {
  // 2026-05-06 — Path-2 read-path swap for single-row fetch.
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence_packets')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  if (data) return parsePostgresRow(data);
  return null;
}

export async function getPacketsNeedingRole() {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('getPacketsNeedingRole: Supabase client unavailable.');
  const { data, error } = await sb
    .from('pcs_evidence_packets')
    .select('*')
    .is('evidence_role', null);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function createEvidencePacket(fields) {
  const properties = {
    [P.name]: { title: [{ text: { content: fields.name || '' } }] },
  };
  if (fields.pcsClaimId) properties[P.pcsClaim] = { relation: [{ id: fields.pcsClaimId }] };
  if (fields.evidenceItemId) properties[P.evidenceItem] = { relation: [{ id: fields.evidenceItemId }] };
  if (fields.evidenceRole) properties[P.evidenceRole] = { select: { name: fields.evidenceRole } };
  if (fields.meetsSqrThreshold !== undefined) properties[P.meetsSqrThreshold] = { checkbox: fields.meetsSqrThreshold };
  if (fields.relevanceNote) properties[P.relevanceNote] = { rich_text: [{ text: { content: fields.relevanceNote } }] };
  if (fields.sortOrder !== undefined) properties[P.sortOrder] = { number: fields.sortOrder };
  Object.assign(properties, laurenTemplateProps(fields));

  const preId = crypto.randomUUID();
  const stubRow = {
    id: preId,
    name: fields.name || '',
    pcsClaimId: fields.pcsClaimId || null,
    evidenceItemId: fields.evidenceItemId || null,
    evidenceRole: fields.evidenceRole || null,
    meetsSqrThreshold: fields.meetsSqrThreshold || false,
    relevanceNote: fields.relevanceNote || '',
    sortOrder: fields.sortOrder ?? null,
    substantiationTier: fields.substantiationTier || null,
    studyDoseAI: fields.studyDoseAI || '',
    studyDoseAmount: fields.studyDoseAmount ?? null,
    studyDoseUnit: fields.studyDoseUnit || null,
    nullResultRationale: fields.nullResultRationale || '',
    keyTakeaway: fields.keyTakeaway || '',
    studyDesignSummary: fields.studyDesignSummary || '',
    sampleSize: fields.sampleSize ?? null,
    positiveResults: fields.positiveResults || '',
    neutralResults: fields.neutralResults || '',
    negativeResults: fields.negativeResults || '',
    potentialBiases: fields.potentialBiases || '',
    confidence: fields.confidence ?? null,
  };
  await writePostgresFirst('pcs_evidence_packets', stubRow, EVIDENCE_PACKETS_PG_COLUMN_MAP);
  return stubRow;
}

export async function deleteEvidencePacket(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('deleteEvidencePacket: Supabase client unavailable.');
  const { error } = await sb.from('pcs_evidence_packets').delete().eq('notion_page_id', id);
  if (error) throw error;
}

/**
 * Wave 8 Phase C4 — inline-edit allowlist for Evidence Packets. Each entry
 * describes how to (a) validate the incoming value and (b) translate it into
 * the equivalent `updateEvidencePacket` fields payload. Keys here are the
 * `fieldPath` strings accepted by the PATCH route and recorded on the
 * PCS Revisions row.
 */
const EDITABLE_PACKET_FIELDS = Object.freeze({
  name: {
    type: 'text',
    toFields: (value) => ({ name: value == null ? '' : String(value) }),
  },
  substantiationTier: {
    type: 'select',
    toFields: (value) => ({ substantiationTier: value || null }),
  },
  evidenceRole: {
    type: 'select',
    toFields: (value) => ({ evidenceRole: value || null }),
  },
  keyTakeaway: {
    type: 'text',
    toFields: (value) => ({ keyTakeaway: value == null ? '' : String(value) }),
  },
  relevanceNote: {
    type: 'text',
    toFields: (value) => ({ relevanceNote: value == null ? '' : String(value) }),
  },
  studyDesignSummary: {
    type: 'text',
    toFields: (value) => ({ studyDesignSummary: value == null ? '' : String(value) }),
  },
  sampleSize: {
    type: 'number',
    toFields: (value) => {
      if (value === null || value === '' || value === undefined) return { sampleSize: null };
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new Error('sampleSize must be a finite number.');
      }
      return { sampleSize: n };
    },
  },
  meetsSqrThreshold: {
    type: 'checkbox',
    toFields: (value) => ({ meetsSqrThreshold: Boolean(value) }),
  },
  nullResultRationale: {
    type: 'text',
    toFields: (value) => ({ nullResultRationale: value == null ? '' : String(value) }),
  },
});

/** Field keys allowed by the Wave 8 Phase C4 inline-edit endpoint. */
export const EVIDENCE_PACKET_EDITABLE_FIELDS = Object.freeze(Object.keys(EDITABLE_PACKET_FIELDS));

/**
 * Wave 8 Phase C4 — single-field inline edit for Evidence Packets.
 * Routed through `mutate()` so every change emits a PCS Revisions row.
 *
 * Only the allowlisted fields in `EDITABLE_PACKET_FIELDS` are accepted;
 * anything else throws synchronously with an `allowlist` error so the
 * caller can return 400.
 *
 * @param {object} args
 * @param {string} args.id         - evidence packet page id
 * @param {string} args.fieldPath  - one of EVIDENCE_PACKET_EDITABLE_FIELDS
 * @param {*}      args.value      - new value (shape depends on field type)
 * @param {object} [args.actor]    - { email, roles } — forwarded to mutate()
 * @param {string} [args.reason]   - optional operator note for the revision row
 * @returns {Promise<object>} the updated packet (as parsed by getEvidencePacket)
 */
export async function updateEvidencePacketField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateEvidencePacketField: id is required.');
  if (!fieldPath || typeof fieldPath !== 'string') {
    throw new Error('updateEvidencePacketField: fieldPath is required.');
  }
  const spec = EDITABLE_PACKET_FIELDS[fieldPath];
  if (!spec) {
    const err = new Error(`Field "${fieldPath}" is not in the Evidence Packet inline-edit allowlist.`);
    err.code = 'allowlist';
    throw err;
  }
  const fields = spec.toFields(value);

  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.EVIDENCE_PACKET,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: (pid) => getEvidencePacket(pid),
    apply: () => updateEvidencePacket(id, fields),
  });
}

export async function updateEvidencePacket(id, fields) {
  const properties = {};
  if (fields.name !== undefined) {
    properties[P.name] = { title: [{ text: { content: fields.name } }] };
  }
  if (fields.evidenceRole !== undefined) {
    properties[P.evidenceRole] = fields.evidenceRole
      ? { select: { name: fields.evidenceRole } }
      : { select: null };
  }
  if (fields.meetsSqrThreshold !== undefined) {
    properties[P.meetsSqrThreshold] = { checkbox: fields.meetsSqrThreshold };
  }
  if (fields.relevanceNote !== undefined) {
    properties[P.relevanceNote] = { rich_text: [{ text: { content: fields.relevanceNote } }] };
  }
  if (fields.sortOrder !== undefined) {
    properties[P.sortOrder] = { number: fields.sortOrder };
  }
  if (fields.pcsClaimId !== undefined) {
    properties[P.pcsClaim] = fields.pcsClaimId
      ? { relation: [{ id: fields.pcsClaimId }] }
      : { relation: [] };
  }
  if (fields.evidenceItemId !== undefined) {
    properties[P.evidenceItem] = fields.evidenceItemId
      ? { relation: [{ id: fields.evidenceItemId }] }
      : { relation: [] };
  }
  Object.assign(properties, laurenTemplateProps(fields));
  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_evidence_packets', stubRow, EVIDENCE_PACKETS_PG_COLUMN_MAP);
  return stubRow;
}
