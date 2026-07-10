/**
 * PCS Active Ingredient Forms CRUD.
 *
 * A Form is a specific chemical/strain expression of a canonical AI:
 * "cholecalciferol" → Vitamin D3, "magnesium glycinate" → Magnesium,
 * "BC30 strain" → Probiotics. Forms are scoped to a single AI via the
 * dual-relation `Active Ingredient` property.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { mutate } from './pcs-mutate.js';
import { getPcsSupabase, writePostgresFirst } from './supabase-pcs.js';


const P = PROPS.ingredientForms;

// ── Postgres path (Part 10 migration) ────────────────────────────────────────
// The pcs_ingredient_forms table stores core relational columns only.
// Rich attributes (diet flags, allergens, strainIdentifier) are Notion-only
// until a schema extension adds them.
const INGREDIENT_FORMS_PG_COLUMN_MAP = {
  activeIngredientId: 'active_ingredient_id',
  bioavailabilityNote: 'bioavailability_notes',
  createdTime: 'notion_created_at',
  lastEditedTime: 'notion_last_edited_at',
};

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    formName: row.form_name || '',
    activeIngredientId: row.active_ingredient_id || null,
    synonyms: '',            // not in current Postgres schema
    bioavailabilityNote: row.bioavailability_notes || '',
    strainIdentifier: '',    // not in current Postgres schema
    source: '',              // not in current Postgres schema
    isDefault: false,        // not in current Postgres schema
    sourceType: null,        // not in current Postgres schema
    veganCompatible: false,  // not in current Postgres schema
    kosher: false,           // not in current Postgres schema
    halal: false,            // not in current Postgres schema
    glutenFree: false,       // not in current Postgres schema
    allergens: [],           // not in current Postgres schema
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

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
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_ingredient_forms')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getFormsForIngredient(ingredientId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_ingredient_forms')
    .select('*')
    .eq('active_ingredient_id', ingredientId);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getIngredientForm(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_ingredient_forms')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  if (data) return parsePostgresRow(data);
  return null;
}

export async function createIngredientForm(fields) {
  if (!fields.formName) throw new Error('formName is required');
  const properties = buildProps(fields);
  const preId = crypto.randomUUID();
  const stubRow = {
    id: preId,
    formName: fields.formName || '',
    activeIngredientId: fields.activeIngredientId || null,
    synonyms: fields.synonyms || '',
    bioavailabilityNote: fields.bioavailabilityNote || '',
    strainIdentifier: fields.strainIdentifier || '',
    source: fields.source || '',
    isDefault: fields.isDefault || false,
    sourceType: fields.sourceType || null,
    veganCompatible: fields.veganCompatible || false,
    kosher: fields.kosher || false,
    halal: fields.halal || false,
    glutenFree: fields.glutenFree || false,
    allergens: fields.allergens || [],
  };
  await writePostgresFirst('pcs_ingredient_forms', stubRow, INGREDIENT_FORMS_PG_COLUMN_MAP);
  return stubRow;
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
  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_ingredient_forms', stubRow, INGREDIENT_FORMS_PG_COLUMN_MAP);
  return stubRow;
}

export async function deleteIngredientForm(id) {
  const sb = getPcsSupabase();
  await sb.from('pcs_ingredient_forms').delete().eq('notion_page_id', id);
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
