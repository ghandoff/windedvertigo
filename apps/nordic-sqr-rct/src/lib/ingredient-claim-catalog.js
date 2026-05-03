/**
 * Phase 4.6 Bundle D.1 — Ingredient × Dose × Claim catalog.
 *
 * Per Gina's 2026-04-17 ask:
 *   "at 600 IU vit D3 we can say 'supports bone health, normal mood';
 *    at 1000 IU we add 'supports immune health'"
 *
 * Pulls AICS Claims linked to AICS Documents whose aiName matches the
 * ingredient. Returns claims grouped by demographic age group and sorted
 * by minDose ascending so the cumulative-tier rule applies naturally:
 * at any dose X, all claims with minDose ≤ X are authorized.
 *
 * Currently a *read-only projection*. Future Phase D.2 swaps the projection
 * for a generator that emits a draft AICS .docx given an ingredient name.
 */

import { notion } from './notion.js';
import { PCS_DB, PROPS } from './pcs-config.js';

const PD = PROPS.aicsDocuments;
const PC = PROPS.aicsClaims;

/**
 * Fetch every AICS document whose `aiName` rich_text exactly matches
 * the given ingredient name (case-insensitive). The relation between
 * Active Ingredients and AICS Documents is by name, not by FK — the
 * canonicalization to FK lives in Phase N2.
 */
async function getAicsDocumentsForIngredient(ingredientName) {
  if (!PCS_DB.aicsDocuments || !ingredientName) return [];
  const res = await notion.databases.query({
    database_id: PCS_DB.aicsDocuments,
    page_size: 100,
  });
  const target = String(ingredientName).trim().toLowerCase();
  return res.results.filter((page) => {
    const aiName = (page.properties?.[PD.aiName]?.rich_text || [])
      .map((t) => t.plain_text)
      .join('')
      .trim()
      .toLowerCase();
    return aiName === target;
  });
}

async function getClaimsForAicsDocs(docIds) {
  if (!PCS_DB.aicsClaims || docIds.length === 0) return [];
  const all = [];
  for (const docId of docIds) {
    const res = await notion.databases.query({
      database_id: PCS_DB.aicsClaims,
      filter: { property: PC.aicsDocument, relation: { contains: docId } },
      page_size: 100,
    });
    all.push(...res.results);
  }
  return all;
}

/**
 * Returns the dose-graded claim catalog for one active ingredient.
 *
 * Output:
 *   {
 *     aicsDocs: [{ id, aicsId, raReviewStatus, version }],
 *     byAgeGroup: {
 *       'Toddlers 1-3': [{ minDose, minDoseUnit, claimText, grade, claimStatus, prefix, benefit, ... }, ...],
 *       'Children 4-8': [...],
 *       ...
 *     },
 *     allDemographics: [...],
 *     totalClaims: 18,
 *   }
 */
export async function getDoseGradedClaimsForIngredient(ingredientName) {
  if (!ingredientName) return { aicsDocs: [], byAgeGroup: {}, allDemographics: [], totalClaims: 0 };

  const aicsDocs = await getAicsDocumentsForIngredient(ingredientName);
  if (aicsDocs.length === 0) {
    return { aicsDocs: [], byAgeGroup: {}, allDemographics: [], totalClaims: 0 };
  }

  const docMeta = aicsDocs.map((d) => ({
    id: d.id,
    aicsId: (d.properties?.[PD.aicsId]?.rich_text || [])[0]?.plain_text || null,
    raReviewStatus: d.properties?.[PD.raReviewStatus]?.select?.name || null,
    version: d.properties?.[PD.version]?.number ?? null,
  }));

  const docIds = aicsDocs.map((d) => d.id);
  const claimPages = await getClaimsForAicsDocs(docIds);

  // Parse + sort
  const claims = claimPages.map((p) => ({
    id: p.id,
    claimNo: p.properties?.[PC.claimNo]?.number ?? null,
    claimStatus: p.properties?.[PC.claimStatus]?.select?.name || null,
    claimText:
      (p.properties?.[PC.claimCore]?.rich_text || []).map((t) => t.plain_text).join('') ||
      p.properties?.[PC.claimText]?.title?.[0]?.plain_text ||
      '',
    benefitCategory: p.properties?.[PC.benefitCategory]?.select?.name || null,
    prefix: (p.properties?.[PC.claimPrefix]?.rich_text || [])
      .map((t) => t.plain_text)
      .join(''),
    ageGroup: p.properties?.[PC.ageGroup]?.select?.name || null,
    minDose: p.properties?.[PC.minDose]?.number ?? null,
    minDoseUnit: p.properties?.[PC.minDoseUnit]?.select?.name || null,
    minDoseSecondary: p.properties?.[PC.minDoseSecondary]?.number ?? null,
    minDoseSecondaryUnit: p.properties?.[PC.minDoseSecondaryUnit]?.select?.name || null,
    grade: p.properties?.[PC.grade]?.select?.name || null,
    fdaDsheaDisclaimerRequired: p.properties?.[PC.fdaDsheaDisclaimerRequired]?.checkbox || false,
    aicsDocumentId: (p.properties?.[PC.aicsDocument]?.relation || [])[0]?.id || null,
  }));

  // Group by ageGroup. "Unspecified" bucket for claims with no ageGroup set.
  const byAgeGroup = {};
  for (const c of claims) {
    const key = c.ageGroup || 'Unspecified';
    (byAgeGroup[key] ||= []).push(c);
  }
  // Sort each group by minDose ascending (null doses to the bottom)
  for (const key of Object.keys(byAgeGroup)) {
    byAgeGroup[key].sort((a, b) => {
      if (a.minDose == null && b.minDose == null) return 0;
      if (a.minDose == null) return 1;
      if (b.minDose == null) return -1;
      return a.minDose - b.minDose;
    });
  }

  // Stable demographic order matching Lauren's AICS-0004 template.
  const ORDER = ['Toddlers 1-3 yo', 'Children 4-8 yo', 'Pre-teen 9-12 yo', 'Teen 13-17 yo', 'Adults 18+', 'Unspecified'];
  const allDemographics = ORDER.filter((d) => byAgeGroup[d]).concat(
    Object.keys(byAgeGroup).filter((d) => !ORDER.includes(d)),
  );

  return {
    aicsDocs: docMeta,
    byAgeGroup,
    allDemographics,
    totalClaims: claims.length,
  };
}
