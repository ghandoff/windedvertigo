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

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { memoize, invalidate as invalidateCache } from './in-memory-cache.js';
import { getPcsSupabase, mirrorToPostgres, shouldUseStrongConsistency, writePostgresFirst } from './supabase-pcs.js';

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

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    coreBenefit: p[P.coreBenefit]?.title?.[0]?.plain_text || '',
    benefitCategoryId: (p[P.benefitCategory]?.relation || [])[0]?.id || null,
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    pcsClaimInstanceIds: (p[P.pcsClaimInstances]?.relation || []).map(r => r.id),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
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

/**
 * 2026-05-06 — Path-2 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentCoreBenefitsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.coreBenefits,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_core_benefits', parsed, CORE_BENEFITS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
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
export async function syncSingleCoreBenefitPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_core_benefits', parsed, CORE_BENEFITS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
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
  await notion.pages.update({ page_id: id, archived: true });
  invalidateCoreBenefitsCache();
  // 2026-05-06 — Path-2 Day 2.6 delete-mirror. Notion archives the page;
  // we delete the Postgres row to keep the mirror in sync. Best-effort —
  // failure logs but doesn't bubble to the caller.
  try {
    const sb = getPcsSupabase();
    if (sb) {
      const { error } = await sb.from('pcs_core_benefits').delete().eq('notion_page_id', id);
      if (error) throw error;
    }
  } catch (err) {
    console.warn(`[pcs-core-benefits] Postgres delete-mirror failed for ${id}: ${err.message}`);
  }
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
