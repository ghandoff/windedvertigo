/**
 * PCS Claim Dose Requirements CRUD
 *
 * Join table between PCS Claims and the (AI, amount, unit) combinations
 * required to substantiate them. Implements Lauren template Table 3A's
 * OR logic: a single claim can be supported by any one of several
 * independent ingredient/dose requirements.
 *
 * Combination groups:
 *   - Rows sharing the same `combinationGroup` value are AND
 *     (all required to substantiate the claim).
 *   - Different `combinationGroup` values are OR (any group qualifies).
 *   - Most claims will have one row per group (pure OR).
 *
 * Reference: Lauren's PCS template Table 3A (Claims & Corresponding
 * Minimum Dose), and the Gap Analysis Section 7.1.4 Layer 2 discussion
 * of multi-AI claim support.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase, mirrorToPostgres, shouldUseStrongConsistency, writePostgresFirst } from './supabase-pcs.js';


const P = PROPS.claimDoseReqs;

// ── Postgres path (Part 10 migration) ────────────────────────────────────────
// The pcs_claim_dose_reqs table stores the core dose fields.
// combinationGroup, activeIngredient (text), aiForm, and
// activeIngredientCanonicalId are Notion-only until a schema extension.
const CLAIM_DOSE_REQS_PG_COLUMN_MAP = {
  pcsClaimId: 'claim_id',
  amount: 'dose_min_mg',
  unit: 'dose_unit',
  createdTime: 'notion_created_at',
  lastEditedTime: 'notion_last_edited_at',
};

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    requirement: row.notes || '',       // use notes as fallback label
    pcsClaimId: row.claim_id || null,
    activeIngredient: '',               // not in current Postgres schema
    aiForm: '',                         // not in current Postgres schema
    amount: row.dose_min_mg ?? null,
    unit: row.dose_unit || null,
    combinationGroup: null,             // not in current Postgres schema
    notes: row.notes || '',
    activeIngredientCanonicalId: null,  // not in current Postgres schema
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    requirement: p[P.requirement]?.title?.[0]?.plain_text || '',
    pcsClaimId: (p[P.pcsClaim]?.relation || [])[0]?.id || null,
    activeIngredient: (p[P.activeIngredient]?.rich_text || []).map(t => t.plain_text).join(''),
    aiForm: (p[P.aiForm]?.rich_text || []).map(t => t.plain_text).join(''),
    amount: p[P.amount]?.number ?? null,
    unit: p[P.unit]?.select?.name || null,
    combinationGroup: p[P.combinationGroup]?.number ?? null,
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    // Canonical ingredient relation (Phase 1) — added 2026-04-19
    activeIngredientCanonicalId: (p[P.activeIngredientCanonical]?.relation || [])[0]?.id || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Compose a requirement label from the structured fields.
 * Used as a fallback when `fields.requirement` is not supplied.
 *   composeLabel({activeIngredient:'Vitamin D', amount:1000, unit:'IU'})
 *     → "Vitamin D 1000 IU"
 *   composeLabel({activeIngredient:'Mg', aiForm:'glycinate', amount:200, unit:'mg'})
 *     → "Mg (glycinate) 200 mg"
 */
export function composeLabel({ activeIngredient, aiForm, amount, unit }) {
  const ai = activeIngredient || '';
  const form = aiForm ? ` (${aiForm})` : '';
  const amt = amount != null ? ` ${amount}` : '';
  const u = unit ? ` ${unit}` : '';
  const label = `${ai}${form}${amt}${u}`.trim();
  return label || 'Requirement';
}

export async function getAllClaimDoseReqs(maxPages = 50) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_claim_dose_reqs')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getReqsForClaim(claimId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_claim_dose_reqs')
    .select('*')
    .eq('claim_id', claimId);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getClaimDoseReq(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_claim_dose_reqs')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  if (data) return parsePostgresRow(data);
  return null;
}

export async function createClaimDoseReq(fields) {
  const label = fields.requirement || composeLabel(fields);
  const properties = {
    [P.requirement]: { title: [{ text: { content: label } }] },
  };
  if (fields.pcsClaimId) {
    properties[P.pcsClaim] = { relation: [{ id: fields.pcsClaimId }] };
  }
  if (fields.activeIngredient !== undefined) {
    properties[P.activeIngredient] = { rich_text: [{ text: { content: fields.activeIngredient || '' } }] };
  }
  if (fields.aiForm !== undefined) {
    properties[P.aiForm] = { rich_text: [{ text: { content: fields.aiForm || '' } }] };
  }
  if (fields.amount !== undefined) {
    properties[P.amount] = { number: fields.amount };
  }
  if (fields.unit) {
    properties[P.unit] = { select: { name: fields.unit } };
  }
  if (fields.combinationGroup !== undefined) {
    properties[P.combinationGroup] = { number: fields.combinationGroup ?? 1 };
  } else {
    // Default to group 1 — pure OR (each row its own group is handled client-side)
    properties[P.combinationGroup] = { number: 1 };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  if (fields.activeIngredientCanonicalId) {
    properties[P.activeIngredientCanonical] = { relation: [{ id: fields.activeIngredientCanonicalId }] };
  }

  const preId = crypto.randomUUID();
  const stubRow = {
    id: preId,
    requirement: label,
    pcsClaimId: fields.pcsClaimId || null,
    activeIngredient: fields.activeIngredient || '',
    aiForm: fields.aiForm || '',
    amount: fields.amount ?? null,
    unit: fields.unit || null,
    combinationGroup: fields.combinationGroup ?? 1,
    notes: fields.notes || '',
    activeIngredientCanonicalId: fields.activeIngredientCanonicalId || null,
  };
  await writePostgresFirst('pcs_claim_dose_reqs', stubRow, CLAIM_DOSE_REQS_PG_COLUMN_MAP);
  return stubRow;
}

export async function updateClaimDoseReq(id, fields) {
  const properties = {};
  if (fields.requirement !== undefined) {
    properties[P.requirement] = { title: [{ text: { content: fields.requirement || composeLabel(fields) } }] };
  }
  if (fields.pcsClaimId !== undefined) {
    properties[P.pcsClaim] = fields.pcsClaimId
      ? { relation: [{ id: fields.pcsClaimId }] }
      : { relation: [] };
  }
  if (fields.activeIngredient !== undefined) {
    properties[P.activeIngredient] = { rich_text: [{ text: { content: fields.activeIngredient || '' } }] };
  }
  if (fields.aiForm !== undefined) {
    properties[P.aiForm] = { rich_text: [{ text: { content: fields.aiForm || '' } }] };
  }
  if (fields.amount !== undefined) {
    properties[P.amount] = { number: fields.amount };
  }
  if (fields.unit !== undefined) {
    properties[P.unit] = fields.unit ? { select: { name: fields.unit } } : { select: null };
  }
  if (fields.combinationGroup !== undefined) {
    properties[P.combinationGroup] = { number: fields.combinationGroup };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  if (fields.activeIngredientCanonicalId !== undefined) {
    properties[P.activeIngredientCanonical] = fields.activeIngredientCanonicalId
      ? { relation: [{ id: fields.activeIngredientCanonicalId }] }
      : { relation: [] };
  }

  // Auto-recompose label if the structured fields changed but `requirement`
  // wasn't explicitly set. Only matters on update; create already handles it.
  if (
    fields.requirement === undefined &&
    (fields.activeIngredient !== undefined ||
      fields.aiForm !== undefined ||
      fields.amount !== undefined ||
      fields.unit !== undefined)
  ) {
    const current = await getClaimDoseReq(id);
    const merged = { ...current, ...fields };
    properties[P.requirement] = { title: [{ text: { content: composeLabel(merged) } }] };
  }

  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_claim_dose_reqs', stubRow, CLAIM_DOSE_REQS_PG_COLUMN_MAP);
  return stubRow;
}

export async function deleteClaimDoseReq(id) {
  const sb = getPcsSupabase();
  await sb.from('pcs_claim_dose_reqs').delete().eq('notion_page_id', id);
}

// ── Drift-sync helpers (used by cron until Phase F retire) ────────────────────
export async function syncRecentClaimDoseReqsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.claimDoseReqs,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_claim_dose_reqs', parsed, CLAIM_DOSE_REQS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
}

export async function syncSingleClaimDoseReqPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_claim_dose_reqs', parsed, CLAIM_DOSE_REQS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
}
