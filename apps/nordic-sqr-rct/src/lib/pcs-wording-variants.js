/**
 * PCS Claim Wording Variants CRUD — alternative phrasings for claims.
 *
 * Each variant is a specific wording linked to a PCS claim,
 * with one marked as primary.
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.7 column-name overrides. All mechanical.
const WORDING_VARIANTS_PG_COLUMN_MAP = {};

const P = PROPS.wordingVariants;

/**
 * 2026-05-06 — Path-2 Day 2.7. See pcs-evidence.js for pattern.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    wording: row.wording || '',
    pcsClaimId: row.pcs_claim_id || null,
    isPrimary: row.is_primary || false,
    variantNotes: row.variant_notes || '',
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

export async function getVariantsForClaim(claimId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_wording_variants')
    .select('*')
    .eq('pcs_claim_id', claimId)
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getAllWordingVariants() {
  return await _fetchAllWordingVariantsFromPostgres();
}

async function _fetchAllWordingVariantsFromPostgres() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_wording_variants')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getWordingVariant(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_wording_variants')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  if (data) return parsePostgresRow(data);
  return null;
}

export async function createWordingVariant(fields) {
  const properties = {
    [P.wording]: { title: [{ text: { content: fields.wording } }] },
  };
  if (fields.pcsClaimId) properties[P.pcsClaim] = { relation: [{ id: fields.pcsClaimId }] };
  if (fields.isPrimary !== undefined) properties[P.isPrimary] = { checkbox: fields.isPrimary };
  if (fields.variantNotes) properties[P.variantNotes] = { rich_text: [{ text: { content: fields.variantNotes } }] };

  const preId = crypto.randomUUID();
  const stubRow = {
    id: preId,
    wording: fields.wording || '',
    pcsClaimId: fields.pcsClaimId || null,
    isPrimary: fields.isPrimary || false,
    variantNotes: fields.variantNotes || '',
  };
  await writePostgresFirst('pcs_wording_variants', stubRow, WORDING_VARIANTS_PG_COLUMN_MAP);
  return stubRow;
}

export async function updateWordingVariant(id, fields) {
  const properties = {};
  if (fields.wording !== undefined) {
    properties[P.wording] = { title: [{ text: { content: fields.wording } }] };
  }
  if (fields.isPrimary !== undefined) {
    properties[P.isPrimary] = { checkbox: fields.isPrimary };
  }
  if (fields.variantNotes !== undefined) {
    properties[P.variantNotes] = { rich_text: [{ text: { content: fields.variantNotes } }] };
  }
  if (fields.pcsClaimId !== undefined) {
    properties[P.pcsClaim] = fields.pcsClaimId
      ? { relation: [{ id: fields.pcsClaimId }] }
      : { relation: [] };
  }
  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_wording_variants', stubRow, WORDING_VARIANTS_PG_COLUMN_MAP);
  return stubRow;
}
