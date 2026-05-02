/**
 * Shared pipeline for backfilling canonical Active Ingredient + Active
 * Ingredient Form relations onto pre-existing rows in:
 *   - Formula Lines (single AI + single Form relation)
 *   - Evidence Library (multi AI relation)
 *   - Claim Dose Requirements (single AI relation)
 *
 * Used by both the CLI script (`scripts/backfill-ingredient-relations.mjs`)
 * and the admin API endpoint
 * (`/api/admin/backfill/ingredient-relations`).
 *
 * Pure fuzzy matching against canonical name + comma-separated synonyms;
 * no LLM calls. See `resolveIngredientCached` /  `resolveFormCached`.
 */

import { getAllIngredients, resolveIngredientCached } from './pcs-ingredients.js';
import { getAllIngredientForms, resolveFormCached } from './pcs-ingredient-forms.js';
import { getAllFormulaLines, updateFormulaLine } from './pcs-formula-lines.js';
import { getAllEvidence, updateEvidence } from './pcs-evidence.js';
import { getAllClaimDoseReqs, updateClaimDoseReq } from './pcs-claim-dose-reqs.js';

const NOTION_RATE_MS = 350;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function nonEmpty(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Backfill Formula Lines.
 * For each row missing the canonical AI relation:
 *   - Resolve `row.ai` (or fall back to `row.ingredientForm` legacy title)
 *     against the canonical Active Ingredients list.
 *   - If an AI matched and `row.aiForm` is non-empty, resolve the form
 *     scoped to that AI.
 */
export async function backfillFormulaLines({ ingredients, forms, dryRun, limit }) {
  const rows = await getAllFormulaLines();
  const candidates = rows.filter(r => !r.activeIngredientCanonicalId);
  const target = limit ? candidates.slice(0, limit) : candidates;

  const results = { totalScanned: rows.length, alreadyTagged: rows.length - candidates.length, processed: target.length, matched: [], noMatch: [], errors: [] };

  for (const row of target) {
    const aiText = nonEmpty(row.ai) ? row.ai : (nonEmpty(row.ingredientForm) ? row.ingredientForm : '');
    if (!nonEmpty(aiText)) continue; // skip rows with no AI text — don't count

    const ing = resolveIngredientCached(aiText, ingredients);
    if (!ing) {
      results.noMatch.push({ id: row.id, ai: aiText, aiForm: row.aiForm || null });
      continue;
    }

    let formMatch = null;
    if (nonEmpty(row.aiForm)) {
      formMatch = resolveFormCached(row.aiForm, ing.id, forms);
    }

    const update = { activeIngredientCanonicalId: ing.id };
    if (formMatch) update.activeIngredientFormCanonicalId = formMatch.id;

    results.matched.push({
      id: row.id,
      ai: aiText,
      matchedIngredient: ing.canonicalName,
      ingredientId: ing.id,
      aiForm: row.aiForm || null,
      matchedForm: formMatch?.formName || null,
      formId: formMatch?.id || null,
    });

    if (!dryRun) {
      try {
        await updateFormulaLine(row.id, update);
        await sleep(NOTION_RATE_MS);
      } catch (err) {
        results.errors.push({ id: row.id, ai: aiText, error: err.message });
      }
    }
  }
  return results;
}

/**
 * Backfill Evidence Library multi-relation.
 * For each row missing any canonical AI relation, run each existing
 * `ingredient` multi-select tag through `resolveIngredientCached` and
 * collect unique matched IDs.
 */
export async function backfillEvidence({ ingredients, dryRun, limit }) {
  const rows = await getAllEvidence();
  const candidates = rows.filter(r => !r.activeIngredientCanonicalIds || r.activeIngredientCanonicalIds.length === 0);
  const target = limit ? candidates.slice(0, limit) : candidates;

  const results = { totalScanned: rows.length, alreadyTagged: rows.length - candidates.length, processed: target.length, matched: [], noMatch: [], errors: [] };

  for (const row of target) {
    const tags = Array.isArray(row.ingredient) ? row.ingredient.filter(nonEmpty) : [];
    if (tags.length === 0) continue; // skip — no source tags to match against

    const matchedIds = [];
    const matchedNames = [];
    const unmatched = [];
    for (const tag of tags) {
      const ing = resolveIngredientCached(tag, ingredients);
      if (ing) {
        if (!matchedIds.includes(ing.id)) {
          matchedIds.push(ing.id);
          matchedNames.push(ing.canonicalName);
        }
      } else {
        unmatched.push(tag);
      }
    }

    if (matchedIds.length === 0) {
      results.noMatch.push({ id: row.id, name: row.name, tags });
      continue;
    }

    results.matched.push({
      id: row.id,
      name: row.name,
      tags,
      matchedIngredients: matchedNames,
      matchedIngredientIds: matchedIds,
      unmatchedTags: unmatched,
    });

    if (!dryRun) {
      try {
        await updateEvidence(row.id, { activeIngredientCanonicalIds: matchedIds });
        await sleep(NOTION_RATE_MS);
      } catch (err) {
        results.errors.push({ id: row.id, name: row.name, error: err.message });
      }
    }
  }
  return results;
}

/**
 * Backfill Claim Dose Requirements.
 * For each row missing the canonical AI relation, fuzzy-match
 * `row.activeIngredient` (rich-text).
 */
export async function backfillClaimDoseReqs({ ingredients, dryRun, limit }) {
  const rows = await getAllClaimDoseReqs();
  const candidates = rows.filter(r => !r.activeIngredientCanonicalId);
  const target = limit ? candidates.slice(0, limit) : candidates;

  const results = { totalScanned: rows.length, alreadyTagged: rows.length - candidates.length, processed: target.length, matched: [], noMatch: [], errors: [] };

  for (const row of target) {
    if (!nonEmpty(row.activeIngredient)) continue;

    const ing = resolveIngredientCached(row.activeIngredient, ingredients);
    if (!ing) {
      results.noMatch.push({ id: row.id, requirement: row.requirement, activeIngredient: row.activeIngredient });
      continue;
    }

    results.matched.push({
      id: row.id,
      requirement: row.requirement,
      activeIngredient: row.activeIngredient,
      matchedIngredient: ing.canonicalName,
      ingredientId: ing.id,
    });

    if (!dryRun) {
      try {
        await updateClaimDoseReq(row.id, { activeIngredientCanonicalId: ing.id });
        await sleep(NOTION_RATE_MS);
      } catch (err) {
        results.errors.push({ id: row.id, requirement: row.requirement, error: err.message });
      }
    }
  }
  return results;
}

/**
 * Run the full backfill pipeline for the requested tables.
 * `tables` is an array containing any of: 'formula', 'evidence', 'claims'.
 * Pre-fetches the canonical ingredient + form lists once, so each table
 * costs O(rows) Notion writes instead of O(rows × ingredients) reads.
 */
export async function runIngredientRelationsBackfill({ tables = ['formula', 'evidence', 'claims'], dryRun = false, limit = null } = {}) {
  const [ingredients, forms] = await Promise.all([
    getAllIngredients(),
    getAllIngredientForms(),
  ]);

  const out = {
    options: { tables, dryRun, limit },
    canonical: { ingredients: ingredients.length, forms: forms.length },
    formula: null,
    evidence: null,
    claims: null,
  };

  if (tables.includes('formula')) {
    out.formula = await backfillFormulaLines({ ingredients, forms, dryRun, limit });
  }
  if (tables.includes('evidence')) {
    out.evidence = await backfillEvidence({ ingredients, dryRun, limit });
  }
  if (tables.includes('claims')) {
    out.claims = await backfillClaimDoseReqs({ ingredients, dryRun, limit });
  }
  return out;
}
