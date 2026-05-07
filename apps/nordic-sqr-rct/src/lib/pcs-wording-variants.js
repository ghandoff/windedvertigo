/**
 * PCS Claim Wording Variants CRUD — alternative phrasings for claims.
 *
 * Each variant is a specific wording linked to a PCS claim,
 * with one marked as primary.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase, shouldReadFromPostgres, mirrorToPostgres } from './supabase-pcs.js';

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

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    wording: p[P.wording]?.title?.[0]?.plain_text || '',
    pcsClaimId: (p[P.pcsClaim]?.relation || [])[0]?.id || null,
    isPrimary: p[P.isPrimary]?.checkbox || false,
    variantNotes: (p[P.variantNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getVariantsForClaim(claimId) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_wording_variants')
        .select('*')
        .eq('pcs_claim_id', claimId)
        .limit(5000);
      if (error) throw error;
      return (data || []).map(parsePostgresRow);
    } catch (err) {
      console.warn(`[pcs-wording-variants] Postgres forClaim failed, falling back to Notion: ${err.message}`);
    }
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.wordingVariants,
    filter: { property: P.pcsClaim, relation: { contains: claimId } },
  });
  return res.results.map(parsePage);
}

export async function getAllWordingVariants() {
  if (shouldReadFromPostgres()) {
    try {
      return await _fetchAllWordingVariantsFromPostgres();
    } catch (err) {
      console.warn(`[pcs-wording-variants] Postgres read failed, falling back to Notion: ${err.message}`);
    }
  }
  return _fetchAllWordingVariantsFromNotion();
}

async function _fetchAllWordingVariantsFromNotion() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.wordingVariants,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
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
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_wording_variants')
        .select('*')
        .eq('notion_page_id', id)
        .maybeSingle();
      if (error) throw error;
      if (data) return parsePostgresRow(data);
    } catch (err) {
      console.warn(`[pcs-wording-variants] Postgres single-row read failed, falling back to Notion: ${err.message}`);
    }
  }
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

/**
 * 2026-05-06 — Path-2 Day 2.7 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentWordingVariantsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.wordingVariants,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_wording_variants', parsed, WORDING_VARIANTS_PG_COLUMN_MAP);
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
}

export async function createWordingVariant(fields) {
  const properties = {
    [P.wording]: { title: [{ text: { content: fields.wording } }] },
  };
  if (fields.pcsClaimId) properties[P.pcsClaim] = { relation: [{ id: fields.pcsClaimId }] };
  if (fields.isPrimary !== undefined) properties[P.isPrimary] = { checkbox: fields.isPrimary };
  if (fields.variantNotes) properties[P.variantNotes] = { rich_text: [{ text: { content: fields.variantNotes } }] };

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.wordingVariants },
    properties,
  });
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_wording_variants', parsed, WORDING_VARIANTS_PG_COLUMN_MAP);
  return parsed;
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
  const page = await notion.pages.update({ page_id: id, properties });
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_wording_variants', parsed, WORDING_VARIANTS_PG_COLUMN_MAP);
  return parsed;
}
