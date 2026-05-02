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


const P = PROPS.claimDoseReqs;

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
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.claimDoseReqs,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages += 1;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getReqsForClaim(claimId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.claimDoseReqs,
    filter: { property: P.pcsClaim, relation: { contains: claimId } },
    sorts: [
      { property: P.combinationGroup, direction: 'ascending' },
    ],
  });
  return res.results.map(parsePage);
}

export async function getClaimDoseReq(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
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

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.claimDoseReqs },
    properties,
  });
  return parsePage(page);
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

  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deleteClaimDoseReq(id) {
  await notion.pages.update({ page_id: id, archived: true });
}
