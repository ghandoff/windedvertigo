/**
 * PCS Core Benefits CRUD
 *
 * The prefix-stripped body of a claim — the crux of what the claim says
 * (e.g. "normal mood", "cellular energy"). Multiple PCS claim instances
 * can share the same core benefit, optionally combined with different
 * prefixes to form distinct canonical claims.
 *
 * Multi-profile architecture (Week 1) — added 2026-04-19.
 */

import { PROPS } from './pcs-config.js';
import { memoize, invalidate as invalidateCache } from './in-memory-cache.js';
import { getPcsSupabase, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.6. No special column-name overrides for
// pcs_core_benefits; all fields follow the camelCase → snake_case
// convention.
const CORE_BENEFITS_PG_COLUMN_MAP = {};


const P = PROPS.coreBenefits;
const CORE_BENEFITS_CACHE_KEY = 'core-benefits:all';
const CORE_BENEFITS_CACHE_TTL_MS = 300_000; // 5 min — changes weekly

/** Drop the cached core-benefit list. Call after any core-benefit write. */
export function invalidateCoreBenefitsCache() {
  invalidateCache(CORE_BENEFITS_CACHE_KEY);
}

/**
 * 2026-05-06 — Path-2 Day 2.6 read-path swap. Convert a Postgres
 * pcs_core_benefits row into the SAME shape parsePage(notionPage)
 * returns.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    coreBenefit: row.core_benefit || '',
    benefitCategoryId: row.benefit_category_id || null,
    notes: row.notes || '',
    pcsClaimInstanceIds: row.pcs_claim_instance_ids || [],
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

export async function getAllCoreBenefits(opts = {}) {
  return memoize(
    CORE_BENEFITS_CACHE_KEY,
    CORE_BENEFITS_CACHE_TTL_MS,
    _fetchAllCoreBenefits,
    opts,
  );
}

async function _fetchAllCoreBenefits() {
  return await _fetchAllCoreBenefitsFromPostgres();
}

async function _fetchAllCoreBenefitsFromPostgres() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_core_benefits')
    .select('*')
    .order('core_benefit', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getCoreBenefit(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_core_benefits')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

export async function createCoreBenefit(fields) {
  const properties = {
    [P.coreBenefit]: { title: [{ text: { content: fields.coreBenefit || '' } }] },
  };
  if (fields.benefitCategoryId) {
    properties[P.benefitCategory] = { relation: [{ id: fields.benefitCategoryId }] };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  const preId = crypto.randomUUID();
  const stubRow = {
    id: preId,
    coreBenefit: fields.coreBenefit || '',
    benefitCategoryId: fields.benefitCategoryId || null,
    notes: fields.notes || '',
    pcsClaimInstanceIds: [],
  };
  await writePostgresFirst('pcs_core_benefits', stubRow, CORE_BENEFITS_PG_COLUMN_MAP);
  invalidateCoreBenefitsCache();
  return stubRow;
}

export async function updateCoreBenefit(id, fields) {
  const properties = {};
  if (fields.coreBenefit !== undefined) {
    properties[P.coreBenefit] = { title: [{ text: { content: fields.coreBenefit || '' } }] };
  }
  if (fields.benefitCategoryId !== undefined) {
    properties[P.benefitCategory] = fields.benefitCategoryId
      ? { relation: [{ id: fields.benefitCategoryId }] }
      : { relation: [] };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_core_benefits', stubRow, CORE_BENEFITS_PG_COLUMN_MAP);
  invalidateCoreBenefitsCache();
  return stubRow;
}

export async function deleteCoreBenefit(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('deleteCoreBenefit: Supabase client unavailable.');
  const { error } = await sb.from('pcs_core_benefits').delete().eq('notion_page_id', id);
  if (error) throw error;
  invalidateCoreBenefitsCache();
}

/**
 * Resolve an existing core benefit by text (case-insensitive trim) or
 * create a new one if no match. Returns the resolved/created row.
 *
 * Used by the PDF import pipeline to fold extracted core-benefit text
 * (e.g. "normal mood") into a stable taxonomy entry without operator
 * intervention. Operators can later edit category/notes in the UI.
 */
export async function resolveOrCreate(text, benefitCategoryId = null) {
  if (!text || typeof text !== 'string') return null;
  const target = text.trim();
  if (!target) return null;
  const targetLower = target.toLowerCase();
  const all = await getAllCoreBenefits();
  const existing = all.find(c => c.coreBenefit.trim().toLowerCase() === targetLower);
  if (existing) return existing;
  return await createCoreBenefit({ coreBenefit: target, benefitCategoryId });
}
