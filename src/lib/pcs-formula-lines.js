/**
 * PCS Formula Lines CRUD — supplement facts / composition data.
 *
 * Each formula line represents an ingredient row from the PCS
 * supplement facts table, linked to a PCS version.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.formulaLines;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    ingredientForm: p[P.ingredientForm]?.title?.[0]?.plain_text || '',
    pcsVersionId: (p[P.pcsVersion]?.relation || [])[0]?.id || null,
    ingredientSource: (p[P.ingredientSource]?.rich_text || []).map(t => t.plain_text).join(''),
    elementalAI: p[P.elementalAI]?.select?.name || null,
    elementalAmountMg: p[P.elementalAmountMg]?.number ?? null,
    ratioNote: (p[P.ratioNote]?.rich_text || []).map(t => t.plain_text).join(''),
    servingBasisNote: (p[P.servingBasisNote]?.rich_text || []).map(t => t.plain_text).join(''),
    formulaNotes: (p[P.formulaNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    // Lauren's template Table 2 decomposition — added 2026-04-18
    ai: (p[P.ai]?.rich_text || []).map(t => t.plain_text).join(''),
    aiForm: (p[P.aiForm]?.rich_text || []).map(t => t.plain_text).join(''),
    fmPlm: (p[P.fmPlm]?.rich_text || []).map(t => t.plain_text).join(''),
    amountPerServing: p[P.amountPerServing]?.number ?? null,
    amountUnit: p[P.amountUnit]?.select?.name || null,
    percentDailyValue: p[P.percentDailyValue]?.number ?? null,
    // Canonical ingredient relations (Phase 1) — added 2026-04-19
    activeIngredientCanonicalId: (p[P.activeIngredientCanonical]?.relation || [])[0]?.id || null,
    activeIngredientFormCanonicalId: (p[P.activeIngredientFormCanonical]?.relation || [])[0]?.id || null,
    // Wave 4.5.5 — per-item extractor confidence (0-1; Notion stores percent as fraction)
    confidence: p[P.confidence]?.number ?? null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Build the Notion properties payload for Lauren's template fields.
 * Sparse update — only touches keys explicitly present in `fields`.
 */
function laurenTemplateProps(fields) {
  const out = {};
  if (fields.ai !== undefined) {
    out[P.ai] = { rich_text: [{ text: { content: fields.ai || '' } }] };
  }
  if (fields.aiForm !== undefined) {
    out[P.aiForm] = { rich_text: [{ text: { content: fields.aiForm || '' } }] };
  }
  if (fields.fmPlm !== undefined) {
    out[P.fmPlm] = { rich_text: [{ text: { content: fields.fmPlm || '' } }] };
  }
  if (fields.amountPerServing !== undefined) {
    out[P.amountPerServing] = { number: fields.amountPerServing };
  }
  if (fields.amountUnit !== undefined) {
    out[P.amountUnit] = fields.amountUnit
      ? { select: { name: fields.amountUnit } }
      : { select: null };
  }
  if (fields.percentDailyValue !== undefined) {
    out[P.percentDailyValue] = { number: fields.percentDailyValue };
  }
  if (fields.activeIngredientCanonicalId !== undefined) {
    out[P.activeIngredientCanonical] = fields.activeIngredientCanonicalId
      ? { relation: [{ id: fields.activeIngredientCanonicalId }] }
      : { relation: [] };
  }
  if (fields.activeIngredientFormCanonicalId !== undefined) {
    out[P.activeIngredientFormCanonical] = fields.activeIngredientFormCanonicalId
      ? { relation: [{ id: fields.activeIngredientFormCanonicalId }] }
      : { relation: [] };
  }
  // Wave 4.5.5 — extractor confidence. Explicit null clears; undefined skips.
  if (fields.confidence !== undefined) {
    out[P.confidence] = { number: fields.confidence };
  }
  return out;
}

export async function getFormulaLinesForVersion(versionId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.formulaLines,
    filter: { property: P.pcsVersion, relation: { contains: versionId } },
  });
  return res.results.map(parsePage);
}

export async function getAllFormulaLines() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.formulaLines,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getFormulaLine(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function createFormulaLine(fields) {
  const properties = {
    [P.ingredientForm]: { title: [{ text: { content: fields.ingredientForm } }] },
  };
  if (fields.pcsVersionId) properties[P.pcsVersion] = { relation: [{ id: fields.pcsVersionId }] };
  if (fields.ingredientSource) properties[P.ingredientSource] = { rich_text: [{ text: { content: fields.ingredientSource } }] };
  if (fields.elementalAI) properties[P.elementalAI] = { select: { name: fields.elementalAI } };
  if (fields.elementalAmountMg !== undefined) properties[P.elementalAmountMg] = { number: fields.elementalAmountMg };
  if (fields.ratioNote) properties[P.ratioNote] = { rich_text: [{ text: { content: fields.ratioNote } }] };
  if (fields.servingBasisNote) properties[P.servingBasisNote] = { rich_text: [{ text: { content: fields.servingBasisNote } }] };
  if (fields.formulaNotes) properties[P.formulaNotes] = { rich_text: [{ text: { content: fields.formulaNotes } }] };
  Object.assign(properties, laurenTemplateProps(fields));

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.formulaLines },
    properties,
  });
  return parsePage(page);
}

/**
 * Wave 8.2 — fields revertable by the revisions panel. Single-field writes
 * route through mutate() so an audit row is captured. Mirrors the C-phase
 * shape used by canonical_claim/document/claim/evidence_packet.
 */
export const FORMULA_LINE_EDITABLE_FIELDS = Object.freeze([
  'ingredientForm', 'ingredientSource', 'elementalAI', 'elementalAmountMg',
  'ratioNote', 'servingBasisNote', 'formulaNotes',
  'ai', 'aiForm', 'fmPlm', 'amountPerServing', 'amountUnit', 'percentDailyValue',
  'activeIngredientCanonicalId', 'activeIngredientFormCanonicalId',
]);

export function isEditableFormulaLineField(fieldPath) {
  return FORMULA_LINE_EDITABLE_FIELDS.includes(fieldPath);
}

export async function updateFormulaLineField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateFormulaLineField: id is required.');
  if (!isEditableFormulaLineField(fieldPath)) {
    const err = new Error(`updateFormulaLineField: fieldPath "${fieldPath}" is not editable via this endpoint.`);
    err.code = 'field-not-allowed';
    throw err;
  }
  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.FORMULA_LINE,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: (entityId) => getFormulaLine(entityId),
    apply: () => updateFormulaLine(id, { [fieldPath]: value }),
  });
}

export async function updateFormulaLine(id, fields) {
  const properties = {};
  if (fields.ingredientForm !== undefined) {
    properties[P.ingredientForm] = { title: [{ text: { content: fields.ingredientForm } }] };
  }
  if (fields.ingredientSource !== undefined) {
    properties[P.ingredientSource] = { rich_text: [{ text: { content: fields.ingredientSource } }] };
  }
  if (fields.elementalAI !== undefined) {
    properties[P.elementalAI] = { select: { name: fields.elementalAI } };
  }
  if (fields.elementalAmountMg !== undefined) {
    properties[P.elementalAmountMg] = { number: fields.elementalAmountMg };
  }
  if (fields.ratioNote !== undefined) {
    properties[P.ratioNote] = { rich_text: [{ text: { content: fields.ratioNote } }] };
  }
  if (fields.servingBasisNote !== undefined) {
    properties[P.servingBasisNote] = { rich_text: [{ text: { content: fields.servingBasisNote } }] };
  }
  if (fields.formulaNotes !== undefined) {
    properties[P.formulaNotes] = { rich_text: [{ text: { content: fields.formulaNotes } }] };
  }
  Object.assign(properties, laurenTemplateProps(fields));
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
