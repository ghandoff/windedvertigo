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


const P = PROPS.coreBenefits;

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

export async function getAllCoreBenefits() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.coreBenefits,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: P.coreBenefit, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getCoreBenefit(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
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
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.coreBenefits },
    properties,
  });
  return parsePage(page);
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
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deleteCoreBenefit(id) {
  await notion.pages.update({ page_id: id, archived: true });
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
