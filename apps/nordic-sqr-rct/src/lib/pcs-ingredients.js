/**
 * PCS Active Ingredients CRUD.
 *
 * Canonicalizes ingredient names that previously lived as denormalized
 * rich-text/multi-select on Evidence Library, Formula Lines, and Claim
 * Dose Requirements. The same ingredient appeared as "Vit D3", "vitamin
 * D", "Vitamin D3", "cholecalciferol" — `resolveIngredient(text)` is the
 * fuzzy-match foundation for a future migration script that backfills
 * the new canonical relations.
 *
 * No backfill of existing rows is performed here; canonical relations
 * start empty.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.ingredients;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    canonicalName: p[P.canonicalName]?.title?.[0]?.plain_text || '',
    synonyms: (p[P.synonyms]?.rich_text || []).map(t => t.plain_text).join(''),
    category: p[P.category]?.select?.name || null,
    standardUnit: p[P.standardUnit]?.select?.name || null,
    fdaRdi: p[P.fdaRdi]?.number ?? null,
    fdaRdiUnit: p[P.fdaRdiUnit]?.select?.name || null,
    regulatoryCeiling: p[P.regulatoryCeiling]?.number ?? null,
    bioavailabilityNotes: (p[P.bioavailabilityNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    interactionCautions: (p[P.interactionCautions]?.rich_text || []).map(t => t.plain_text).join(''),
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    formIds: (p[P.forms]?.relation || []).map(r => r.id),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/** Sparse-update helper — only writes properties for keys explicitly present in `fields`. */
function buildProps(fields) {
  const properties = {};
  if (fields.canonicalName !== undefined) {
    properties[P.canonicalName] = { title: [{ text: { content: fields.canonicalName || '' } }] };
  }
  if (fields.synonyms !== undefined) {
    properties[P.synonyms] = { rich_text: [{ text: { content: fields.synonyms || '' } }] };
  }
  if (fields.category !== undefined) {
    properties[P.category] = fields.category ? { select: { name: fields.category } } : { select: null };
  }
  if (fields.standardUnit !== undefined) {
    properties[P.standardUnit] = fields.standardUnit ? { select: { name: fields.standardUnit } } : { select: null };
  }
  if (fields.fdaRdi !== undefined) {
    properties[P.fdaRdi] = { number: fields.fdaRdi };
  }
  if (fields.fdaRdiUnit !== undefined) {
    properties[P.fdaRdiUnit] = fields.fdaRdiUnit ? { select: { name: fields.fdaRdiUnit } } : { select: null };
  }
  if (fields.regulatoryCeiling !== undefined) {
    properties[P.regulatoryCeiling] = { number: fields.regulatoryCeiling };
  }
  if (fields.bioavailabilityNotes !== undefined) {
    properties[P.bioavailabilityNotes] = { rich_text: [{ text: { content: fields.bioavailabilityNotes || '' } }] };
  }
  if (fields.interactionCautions !== undefined) {
    properties[P.interactionCautions] = { rich_text: [{ text: { content: fields.interactionCautions || '' } }] };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  return properties;
}

export async function getAllIngredients(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.ingredients,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages += 1;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getIngredient(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function createIngredient(fields) {
  if (!fields.canonicalName) throw new Error('canonicalName is required');
  const properties = buildProps(fields);
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.ingredients },
    properties,
  });
  return parsePage(page);
}

/** Wave 8.2 — fields revertable by the revisions panel. */
export const INGREDIENT_EDITABLE_FIELDS = Object.freeze([
  'canonicalName', 'synonyms', 'category', 'standardUnit',
  'fdaRdi', 'fdaRdiUnit', 'regulatoryCeiling',
  'bioavailabilityNotes', 'interactionCautions', 'notes',
]);

export function isEditableIngredientField(fieldPath) {
  return INGREDIENT_EDITABLE_FIELDS.includes(fieldPath);
}

export async function updateIngredientField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateIngredientField: id is required.');
  if (!isEditableIngredientField(fieldPath)) {
    const err = new Error(`updateIngredientField: fieldPath "${fieldPath}" is not editable via this endpoint.`);
    err.code = 'field-not-allowed';
    throw err;
  }
  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.ACTIVE_INGREDIENT,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: (entityId) => getIngredient(entityId),
    apply: () => updateIngredient(id, { [fieldPath]: value }),
  });
}

export async function updateIngredient(id, fields) {
  const properties = buildProps(fields);
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deleteIngredient(id) {
  await notion.pages.update({ page_id: id, archived: true });
}

/**
 * Fuzzy-match an ingredient by free-text label.
 *
 * Strategy (in order):
 *   1. Exact case-insensitive match against canonical_name
 *   2. Comma-separated synonyms — exact case-insensitive match
 *   3. Substring match (text appears inside canonical_name or any synonym,
 *      or canonical_name appears inside text)
 *
 * Returns the first matching ingredient or null. Pass a pre-fetched
 * `ingredients` array to avoid a Notion call on every lookup (useful
 * for batch migrations).
 */
export async function resolveIngredient(text, ingredients = null) {
  if (!text || typeof text !== 'string') return null;
  const needle = text.trim().toLowerCase();
  if (!needle) return null;

  const list = ingredients || await getAllIngredients();

  // 1. Exact canonical name
  for (const ing of list) {
    if ((ing.canonicalName || '').trim().toLowerCase() === needle) return ing;
  }
  // 2. Exact synonym
  for (const ing of list) {
    const syns = (ing.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (syns.includes(needle)) return ing;
  }
  // 3. Substring (either direction)
  for (const ing of list) {
    const cn = (ing.canonicalName || '').trim().toLowerCase();
    if (cn && (needle.includes(cn) || cn.includes(needle))) return ing;
    const syns = (ing.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    for (const s of syns) {
      if (s && (needle.includes(s) || s.includes(needle))) return ing;
    }
  }
  return null;
}

/**
 * Synchronous version of `resolveIngredient` that requires a pre-fetched
 * `ingredients` array. Use this in batch backfills to avoid an N+1 Notion
 * fetch on every lookup. Same matching strategy as `resolveIngredient`.
 */
export function resolveIngredientCached(text, ingredients) {
  if (!Array.isArray(ingredients)) {
    throw new Error('resolveIngredientCached requires a pre-fetched ingredients array');
  }
  if (!text || typeof text !== 'string') return null;
  const needle = text.trim().toLowerCase();
  if (!needle) return null;

  for (const ing of ingredients) {
    if ((ing.canonicalName || '').trim().toLowerCase() === needle) return ing;
  }
  for (const ing of ingredients) {
    const syns = (ing.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (syns.includes(needle)) return ing;
  }
  for (const ing of ingredients) {
    const cn = (ing.canonicalName || '').trim().toLowerCase();
    if (cn && (needle.includes(cn) || cn.includes(needle))) return ing;
    const syns = (ing.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    for (const s of syns) {
      if (s && (needle.includes(s) || s.includes(needle))) return ing;
    }
  }
  return null;
}
