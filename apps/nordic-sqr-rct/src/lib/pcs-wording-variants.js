/**
 * PCS Claim Wording Variants CRUD — alternative phrasings for claims.
 *
 * Each variant is a specific wording linked to a PCS claim,
 * with one marked as primary.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.wordingVariants;

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
  const res = await notion.databases.query({
    database_id: PCS_DB.wordingVariants,
    filter: { property: P.pcsClaim, relation: { contains: claimId } },
  });
  return res.results.map(parsePage);
}

export async function getAllWordingVariants() {
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

export async function getWordingVariant(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
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
  return parsePage(page);
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
  return parsePage(page);
}
