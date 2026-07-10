/**
 * PCS References CRUD — junction table linking PCS Versions to Evidence items.
 *
 * Each reference maps a PCS-local citation label (e.g., "[12]") to a
 * canonical evidence library entry, with the original bibliography text.
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.7 column-name overrides for pcs_references.
// All camelCase keys map mechanically.
const REFERENCES_PG_COLUMN_MAP = {};

const P = PROPS.references;

/**
 * 2026-05-06 — Path-2 Day 2.7. See pcs-evidence.js for pattern.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    name: row.name || '',
    pcsReferenceLabel: row.pcs_reference_label || '',
    referenceTextAsWritten: row.reference_text_as_written || '',
    referenceNotes: row.reference_notes || '',
    pcsVersionId: row.pcs_version_id || null,
    evidenceItemId: row.evidence_item_id || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

export async function getReferencesForVersion(versionId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_references')
    .select('*')
    .eq('pcs_version_id', versionId)
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getAllReferences() {
  return await _fetchAllReferencesFromPostgres();
}

async function _fetchAllReferencesFromPostgres() {
  // 1,531 rows today — biggest of the batch. Single query at limit 5000.
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_references')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getReference(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_references')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

export async function getUnlinkedReferences() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_references')
    .select('*')
    .is('evidence_item_id', null)
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function createReference(fields) {
  const properties = {
    [P.name]: { title: [{ text: { content: fields.name || '' } }] },
  };
  if (fields.pcsReferenceLabel) {
    properties[P.pcsReferenceLabel] = { rich_text: [{ text: { content: fields.pcsReferenceLabel } }] };
  }
  if (fields.referenceTextAsWritten) {
    properties[P.referenceTextAsWritten] = { rich_text: [{ text: { content: fields.referenceTextAsWritten } }] };
  }
  if (fields.referenceNotes) {
    properties[P.referenceNotes] = { rich_text: [{ text: { content: fields.referenceNotes } }] };
  }
  if (fields.pcsVersionId) {
    properties[P.pcsVersion] = { relation: [{ id: fields.pcsVersionId }] };
  }
  if (fields.evidenceItemId) {
    properties[P.evidenceItem] = { relation: [{ id: fields.evidenceItemId }] };
  }
  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      name: fields.name || '',
      pcsReferenceLabel: fields.pcsReferenceLabel || '',
      referenceTextAsWritten: fields.referenceTextAsWritten || '',
      referenceNotes: fields.referenceNotes || '',
      pcsVersionId: fields.pcsVersionId || null,
      evidenceItemId: fields.evidenceItemId || null,
    };
    await writePostgresFirst('pcs_references', stubRow, REFERENCES_PG_COLUMN_MAP);
    return stubRow;
  }
}

export async function updateReference(id, fields) {
  const properties = {};
  if (fields.name !== undefined) {
    properties[P.name] = { title: [{ text: { content: fields.name } }] };
  }
  if (fields.pcsReferenceLabel !== undefined) {
    properties[P.pcsReferenceLabel] = { rich_text: [{ text: { content: fields.pcsReferenceLabel } }] };
  }
  if (fields.referenceTextAsWritten !== undefined) {
    properties[P.referenceTextAsWritten] = { rich_text: [{ text: { content: fields.referenceTextAsWritten } }] };
  }
  if (fields.referenceNotes !== undefined) {
    properties[P.referenceNotes] = { rich_text: [{ text: { content: fields.referenceNotes } }] };
  }
  if (fields.evidenceItemId !== undefined) {
    properties[P.evidenceItem] = fields.evidenceItemId
      ? { relation: [{ id: fields.evidenceItemId }] }
      : { relation: [] };
  }
  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...fields };
    await writePostgresFirst('pcs_references', stubRow, REFERENCES_PG_COLUMN_MAP);
    return stubRow;
  }
}
