/**
 * PCS Benefit Categories CRUD
 *
 * Hierarchical taxonomy of benefit categories (Brain / cognition / mood,
 * Cardiovascular, Sleep, etc.). Self-referential parent-child relation
 * supports nested subcategories.
 *
 * Multi-profile architecture (Week 1) — added 2026-04-19.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.benefitCategories;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    parentCategoryId: (p[P.parentCategory]?.relation || [])[0]?.id || null,
    displayOrder: p[P.displayOrder]?.number ?? null,
    icon: (p[P.icon]?.rich_text || []).map(t => t.plain_text).join(''),
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllBenefitCategories() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.benefitCategories,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: P.displayOrder, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getBenefitCategory(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function createBenefitCategory(fields) {
  const properties = {
    [P.name]: { title: [{ text: { content: fields.name || '' } }] },
  };
  if (fields.parentCategoryId) {
    properties[P.parentCategory] = { relation: [{ id: fields.parentCategoryId }] };
  }
  if (fields.displayOrder !== undefined) {
    properties[P.displayOrder] = { number: fields.displayOrder };
  }
  if (fields.icon !== undefined) {
    properties[P.icon] = { rich_text: [{ text: { content: fields.icon || '' } }] };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.benefitCategories },
    properties,
  });
  return parsePage(page);
}

export async function updateBenefitCategory(id, fields) {
  const properties = {};
  if (fields.name !== undefined) {
    properties[P.name] = { title: [{ text: { content: fields.name || '' } }] };
  }
  if (fields.parentCategoryId !== undefined) {
    properties[P.parentCategory] = fields.parentCategoryId
      ? { relation: [{ id: fields.parentCategoryId }] }
      : { relation: [] };
  }
  if (fields.displayOrder !== undefined) {
    properties[P.displayOrder] = { number: fields.displayOrder };
  }
  if (fields.icon !== undefined) {
    properties[P.icon] = { rich_text: [{ text: { content: fields.icon || '' } }] };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deleteBenefitCategory(id) {
  await notion.pages.update({ page_id: id, archived: true });
}

/**
 * Get all direct children of a benefit category.
 */
export async function getChildren(parentId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.benefitCategories,
    filter: { property: P.parentCategory, relation: { contains: parentId } },
    sorts: [{ property: P.displayOrder, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

/**
 * Resolve a benefit category by name (case-insensitive trim).
 * Returns the matching row or null.
 */
export async function resolveByName(name) {
  if (!name || typeof name !== 'string') return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const all = await getAllBenefitCategories();
  return all.find(c => c.name.trim().toLowerCase() === target) || null;
}
