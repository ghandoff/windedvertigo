/**
 * PCS Active Ingredient Forms CRUD.
 *
 * A Form is a specific chemical/strain expression of a canonical AI:
 * "cholecalciferol" → Vitamin D3, "magnesium glycinate" → Magnesium,
 * "BC30 strain" → Probiotics. Forms are scoped to a single AI via the
 * dual-relation `Active Ingredient` property.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.ingredientForms;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    formName: p[P.formName]?.title?.[0]?.plain_text || '',
    activeIngredientId: (p[P.activeIngredient]?.relation || [])[0]?.id || null,
    synonyms: (p[P.synonyms]?.rich_text || []).map(t => t.plain_text).join(''),
    bioavailabilityNote: (p[P.bioavailabilityNote]?.rich_text || []).map(t => t.plain_text).join(''),
    strainIdentifier: (p[P.strainIdentifier]?.rich_text || []).map(t => t.plain_text).join(''),
    source: (p[P.source]?.rich_text || []).map(t => t.plain_text).join(''),
    isDefault: p[P.isDefault]?.checkbox || false,
    // Wave 7.0.5 T6 — first-class source/diet attributes (added 2026-04-21)
    sourceType: p[P.sourceType]?.select?.name || null,
    veganCompatible: p[P.veganCompatible]?.checkbox || false,
    kosher: p[P.kosher]?.checkbox || false,
    halal: p[P.halal]?.checkbox || false,
    glutenFree: p[P.glutenFree]?.checkbox || false,
    allergens: (p[P.allergens]?.multi_select || []).map(o => o.name),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

function buildProps(fields) {
  const properties = {};
  if (fields.formName !== undefined) {
    properties[P.formName] = { title: [{ text: { content: fields.formName || '' } }] };
  }
  if (fields.activeIngredientId !== undefined) {
    properties[P.activeIngredient] = fields.activeIngredientId
      ? { relation: [{ id: fields.activeIngredientId }] }
      : { relation: [] };
  }
  if (fields.synonyms !== undefined) {
    properties[P.synonyms] = { rich_text: [{ text: { content: fields.synonyms || '' } }] };
  }
  if (fields.bioavailabilityNote !== undefined) {
    properties[P.bioavailabilityNote] = { rich_text: [{ text: { content: fields.bioavailabilityNote || '' } }] };
  }
  if (fields.strainIdentifier !== undefined) {
    properties[P.strainIdentifier] = { rich_text: [{ text: { content: fields.strainIdentifier || '' } }] };
  }
  if (fields.source !== undefined) {
    properties[P.source] = { rich_text: [{ text: { content: fields.source || '' } }] };
  }
  if (fields.isDefault !== undefined) {
    properties[P.isDefault] = { checkbox: !!fields.isDefault };
  }
  // Wave 7.0.5 T6 — first-class source/diet attributes (added 2026-04-21)
  if (fields.sourceType !== undefined) {
    properties[P.sourceType] = fields.sourceType
      ? { select: { name: fields.sourceType } }
      : { select: null };
  }
  if (fields.veganCompatible !== undefined) {
    properties[P.veganCompatible] = { checkbox: !!fields.veganCompatible };
  }
  if (fields.kosher !== undefined) {
    properties[P.kosher] = { checkbox: !!fields.kosher };
  }
  if (fields.halal !== undefined) {
    properties[P.halal] = { checkbox: !!fields.halal };
  }
  if (fields.glutenFree !== undefined) {
    properties[P.glutenFree] = { checkbox: !!fields.glutenFree };
  }
  if (fields.allergens !== undefined) {
    properties[P.allergens] = {
      multi_select: (fields.allergens || []).map(name => ({ name })),
    };
  }
  return properties;
}

export async function getAllIngredientForms(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.ingredientForms,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages += 1;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

/**
 * Query Active Ingredient Forms where `Vegan compatible=true`.
 * Flat array. Used by Living PCS + product filters to surface the
 * algae/lanolin-alt portfolio to vegan customers. (Wave 7.0.5 T6)
 */
export async function getVeganCompatibleForms() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.ingredientForms,
      page_size: 100,
      start_cursor: cursor,
      filter: { property: P.veganCompatible, checkbox: { equals: true } },
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getFormsForIngredient(ingredientId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.ingredientForms,
    filter: { property: P.activeIngredient, relation: { contains: ingredientId } },
  });
  return res.results.map(parsePage);
}

export async function getIngredientForm(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function createIngredientForm(fields) {
  if (!fields.formName) throw new Error('formName is required');
  const properties = buildProps(fields);
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.ingredientForms },
    properties,
  });
  return parsePage(page);
}

/** Wave 8.2 — fields revertable by the revisions panel. */
export const INGREDIENT_FORM_EDITABLE_FIELDS = Object.freeze([
  'formName', 'synonyms', 'bioavailabilityNote', 'strainIdentifier',
  'source', 'isDefault',
  // Wave 7.0.5 T6 source/diet attributes
  'sourceType', 'veganCompatible', 'kosher', 'halal', 'glutenFree', 'allergens',
]);

export function isEditableIngredientFormField(fieldPath) {
  return INGREDIENT_FORM_EDITABLE_FIELDS.includes(fieldPath);
}

export async function updateIngredientFormField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateIngredientFormField: id is required.');
  if (!isEditableIngredientFormField(fieldPath)) {
    const err = new Error(`updateIngredientFormField: fieldPath "${fieldPath}" is not editable via this endpoint.`);
    err.code = 'field-not-allowed';
    throw err;
  }
  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.ACTIVE_INGREDIENT_FORM,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: (entityId) => getIngredientForm(entityId),
    apply: () => updateIngredientForm(id, { [fieldPath]: value }),
  });
}

export async function updateIngredientForm(id, fields) {
  const properties = buildProps(fields);
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deleteIngredientForm(id) {
  await notion.pages.update({ page_id: id, archived: true });
}

/**
 * Fuzzy-match an AI Form by free-text label.
 *
 * Strategy (in order):
 *   1. Exact case-insensitive match against form_name
 *   2. Comma-separated synonyms — exact case-insensitive match
 *   3. Substring match against form_name or any synonym
 *
 * If `ingredientId` is provided, only forms scoped to that AI are
 * considered; otherwise all forms are searched. Returns null if no
 * match. Pass a pre-fetched `forms` array to skip the Notion call
 * (useful for batch migrations).
 */
export async function resolveForm(text, ingredientId = null, forms = null) {
  if (!text || typeof text !== 'string') return null;
  const needle = text.trim().toLowerCase();
  if (!needle) return null;

  let list = forms;
  if (!list) {
    list = ingredientId
      ? await getFormsForIngredient(ingredientId)
      : await getAllIngredientForms();
  } else if (ingredientId) {
    list = list.filter(f => f.activeIngredientId === ingredientId);
  }

  // 1. Exact form name
  for (const f of list) {
    if ((f.formName || '').trim().toLowerCase() === needle) return f;
  }
  // 2. Exact synonym
  for (const f of list) {
    const syns = (f.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (syns.includes(needle)) return f;
  }
  // 3. Substring
  for (const f of list) {
    const fn = (f.formName || '').trim().toLowerCase();
    if (fn && (needle.includes(fn) || fn.includes(needle))) return f;
    const syns = (f.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    for (const s of syns) {
      if (s && (needle.includes(s) || s.includes(needle))) return f;
    }
  }
  return null;
}

/**
 * Synchronous version of `resolveForm` that requires a pre-fetched
 * `forms` array. If `ingredientId` is supplied, only forms scoped to
 * that AI are considered. Use in batch backfills to avoid N+1 Notion
 * lookups.
 */
export function resolveFormCached(text, ingredientId, forms) {
  if (!Array.isArray(forms)) {
    throw new Error('resolveFormCached requires a pre-fetched forms array');
  }
  if (!text || typeof text !== 'string') return null;
  const needle = text.trim().toLowerCase();
  if (!needle) return null;

  const list = ingredientId ? forms.filter(f => f.activeIngredientId === ingredientId) : forms;

  for (const f of list) {
    if ((f.formName || '').trim().toLowerCase() === needle) return f;
  }
  for (const f of list) {
    const syns = (f.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (syns.includes(needle)) return f;
  }
  for (const f of list) {
    const fn = (f.formName || '').trim().toLowerCase();
    if (fn && (needle.includes(fn) || fn.includes(needle))) return f;
    const syns = (f.synonyms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    for (const s of syns) {
      if (s && (needle.includes(s) || s.includes(needle))) return f;
    }
  }
  return null;
}
