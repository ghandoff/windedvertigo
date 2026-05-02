/**
 * Wave 5.4 — Ingredient-safety cross-check support module.
 *
 * Two responsibilities:
 *   1. `findLabelsByIngredientDoseAndDemographic()` — given a safety signal
 *      declared on an Evidence row (ingredient + dose threshold + demographic
 *      filter), query the Product Labels DB and return the set of Active
 *      labels whose printed composition overlaps with the signal.
 *   2. `openSafetyReviewRequest()` — upsert a PCS Request row targeting RA with
 *      priority='Safety', type='label-drift', specific field marker that
 *      identifies the triggering Evidence id so dedup works across retries.
 *
 * The workflow in `src/workflows/ingredient-safety.js` is the only caller.
 *
 * Best-effort: this module is consumed inside workflow steps that already
 * retry on failure, so we throw errors for real infra issues and swallow
 * nothing ourselves.
 */

import { getLabelsForIngredient, getLabel } from './pcs-labels.js';
import { upsertRequest } from './pcs-request-generator.js';

/**
 * Parse a label's free-form `ingredientDoses` rich-text (JSON-ish) into a
 * map of ingredientId → { amount, unit }.
 *
 * Wave 5.0 stored these as JSON text on purpose (see plan §2). Two acceptable
 * shapes:
 *   a) `{ "<ingredientId>": { "amount": 160, "unit": "mg" }, ... }`
 *   b) `[{ "ingredientId": "...", "amount": 160, "unit": "mg" }, ...]`
 *
 * Returns an empty map if the text is blank or cannot be parsed — safety
 * filtering then falls back to ingredient-presence only (conservative side).
 */
function parseDoseMap(richText) {
  if (!richText || typeof richText !== 'string') return {};
  const trimmed = richText.trim();
  if (!trimmed) return {};
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {};
  }
  const out = {};
  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      if (row && typeof row === 'object' && row.ingredientId) {
        out[row.ingredientId] = {
          amount: Number(row.amount) || 0,
          unit: String(row.unit || '').trim(),
        };
      }
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const [id, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object') {
        out[id] = {
          amount: Number(v.amount) || 0,
          unit: String(v.unit || '').trim(),
        };
      }
    }
  }
  return out;
}

/**
 * Very naive dose comparator: only compares when units match exactly.
 * If the label dose is in a different unit from the threshold, we return
 * `true` conservatively so the label still enters the RA review queue —
 * an RA can eyeball the unit mismatch faster than the system can guess
 * the conversion (mg vs g vs mcg vs IU vs CFU are all represented).
 */
function doseMeetsThreshold(labelDose, threshold, unit) {
  if (!labelDose) return false;
  if (!Number.isFinite(threshold) || threshold <= 0) return true; // no threshold → treat presence as hit
  if (!unit) return labelDose.amount >= threshold;
  if (labelDose.unit && labelDose.unit.toLowerCase() !== unit.toLowerCase()) {
    // Unit mismatch — conservative: include for human review.
    return true;
  }
  return labelDose.amount >= threshold;
}

/**
 * Check whether a label's as-marketed demographic overlaps with the signal's
 * demographic filter. Any non-empty intersection on ANY axis counts. If the
 * filter is empty, we treat it as "all demographics match" — the caller
 * declared a population-agnostic safety concern.
 *
 * NOTE: Wave 5 Labels DB does not yet store the four-axis demographic
 * structure natively on the label record (Wave 4.1's PCS-side restructure
 * is upstream). Until demographic properties land on Labels (follow-up in
 * Wave 5.2+), we cannot do a strict intersection and instead return `true`
 * so RA still sees the label — bias toward over-inclusion on safety.
 */
function demographicMatches(_label, demographicFilter) {
  if (!demographicFilter || typeof demographicFilter !== 'object') return true;
  const hasAnyAxisSet = ['biologicalSex', 'ageGroup', 'lifeStage', 'lifestyle']
    .some(axis => Array.isArray(demographicFilter[axis]) && demographicFilter[axis].length > 0);
  if (!hasAnyAxisSet) return true;
  // TODO (Wave 5.2+): read label.biologicalSex / ageGroup / lifeStage / lifestyle
  // once those multi-selects land on the Product Labels DB, and compute real
  // axis intersections. For now, conservative-include.
  return true;
}

/**
 * Find Active product labels that match the safety-signal criteria.
 *
 * @param {object} args
 * @param {string} args.ingredientId           Canonical Ingredients page id.
 * @param {number} [args.doseThreshold]        Threshold amount in `doseUnit`.
 * @param {string} [args.doseUnit]             e.g. 'mg', 'mcg', 'IU', 'CFU'.
 * @param {object} [args.demographicFilter]    { biologicalSex?, ageGroup?, lifeStage?, lifestyle? }
 *
 * @returns {Promise<Array<{ id, sku, pcsId }>>}
 */
export async function findLabelsByIngredientDoseAndDemographic({
  ingredientId,
  doseThreshold = null,
  doseUnit = null,
  demographicFilter = null,
}) {
  if (!ingredientId) return [];

  // Step 1: coarse Notion query — all labels that relate to the ingredient.
  const candidates = await getLabelsForIngredient(ingredientId);

  // Step 2: narrow to Active labels only (Discontinued / Needs Reprint excluded).
  const active = candidates.filter(l => l.status === 'Active' || l.status === 'In Review' || l.status === 'Needs Validation');

  // Step 3: dose + demographic filtering.
  const matched = [];
  for (const label of active) {
    const doseMap = parseDoseMap(label.ingredientDoses);
    const labelDose = doseMap[ingredientId] || null;

    if (doseThreshold != null && Number.isFinite(Number(doseThreshold))) {
      if (!doseMeetsThreshold(labelDose, Number(doseThreshold), doseUnit)) {
        // If no dose info at all on the label, still include — conservative side.
        if (labelDose) continue;
      }
    }

    if (!demographicMatches(label, demographicFilter)) continue;

    matched.push({
      id: label.id,
      sku: label.sku,
      pcsId: label.pcsDocumentId,
      productName: label.productNameAsMarketed || null,
    });
  }

  return matched;
}

/**
 * Open (or dedup-update) a Research Request row representing the
 * "review this SKU against the new safety signal" ask for RA.
 *
 * Dedup key = documentId (PCS) + type ('label-drift') + specificField
 * (formatted as `safety-review:<evidenceId>:<labelId>` so repeated workflow
 * runs for the same Evidence × Label combo land on the same row).
 *
 * @param {object} args
 * @param {string} args.labelId
 * @param {string} args.evidenceId
 * @param {string} args.ingredientId
 * @param {number} [args.doseThreshold]
 * @param {string} [args.doseUnit]
 * @param {string} [args.triggeringUserId]  Notion person id (informational).
 * @returns {Promise<{ action, id, labelId, sku }>}
 */
export async function openSafetyReviewRequest({
  labelId,
  evidenceId,
  ingredientId,
  doseThreshold = null,
  doseUnit = null,
  triggeringUserId = null,
}) {
  if (!labelId) throw new Error('openSafetyReviewRequest: labelId required');
  if (!evidenceId) throw new Error('openSafetyReviewRequest: evidenceId required');

  // Resolve label → PCS documentId. The PCS Request row is related to the
  // backing PCS Document (that's the schema). The label id is preserved in
  // the notes + specificField so RA can click through.
  const label = await getLabel(labelId);
  const documentId = label.pcsDocumentId;
  if (!documentId) {
    // Label without a backing PCS can't fit the Requests schema; return a
    // skipped sentinel so the workflow can aggregate the count without
    // blowing up.
    return { action: 'skipped', id: null, labelId, sku: label.sku, reason: 'label-has-no-pcs' };
  }

  const displaySku = label.sku || labelId.slice(0, 8);
  const doseStr = doseThreshold != null ? ` at ≥${doseThreshold}${doseUnit ? ' ' + doseUnit : ''}` : '';
  const notes = [
    `Automated safety-review request triggered by Evidence row ${evidenceId}.`,
    `Ingredient: ${ingredientId}${doseStr}.`,
    `Label: ${displaySku} (id: ${labelId}).`,
    triggeringUserId ? `Flagged by: ${triggeringUserId}.` : '',
    '',
    'Action: RA to verify whether this SKU is exposed to the safety concern',
    'described by the triggering Evidence row and, if so, initiate a',
    'reformulation or reprint Request. If not exposed, resolve with a note',
    'explaining why (dose below threshold, demographic mismatch, etc.).',
  ].filter(Boolean).join('\n');

  const res = await upsertRequest({
    documentId,
    type: 'label-drift',
    specificField: `safety-review:${evidenceId}:${labelId}`,
    title: `Safety review: ${displaySku} vs Evidence ${evidenceId.slice(0, 8)}`,
    notes,
    assignedRole: 'RA',
    priority: 'Safety',
    source: 'drift-detection',
  });

  return { ...res, labelId, sku: label.sku };
}
