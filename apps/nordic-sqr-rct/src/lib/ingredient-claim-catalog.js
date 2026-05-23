/**
 * Phase 4.6 Bundle D.1 — Ingredient × Dose × Claim catalog.
 *
 * Per Gina's 2026-04-17 ask:
 *   "at 600 IU vit D3 we can say 'supports bone health, normal mood';
 *    at 1000 IU we add 'supports immune health'"
 *
 * Pulls AICS Claims linked to AICS Documents whose ai_name_text matches the
 * ingredient. Returns claims grouped by demographic age group and sorted
 * by min_dose ascending so the cumulative-tier rule applies naturally:
 * at any dose X, all claims with min_dose ≤ X are authorized.
 *
 * Part 10 / Phase G (2026-05-23): Postgres-first using PostgREST embedded
 * resources to JOIN the CV lookup tables (`cv_claim_prefixes`,
 * `cv_demographics_age`). Notion fallback retained for resilience.
 *
 * Currently a *read-only projection*. Future Phase D.2 swaps the projection
 * for a generator that emits a draft AICS .docx given an ingredient name.
 */

import { notion } from './notion.js';
import { PCS_DB, PROPS } from './pcs-config.js';
import { getPcsSupabase } from './supabase-pcs.js';

const PD = PROPS.aicsDocuments;
const PC = PROPS.aicsClaims;

// ─── Reads ──────────────────────────────────────────────────────────────

async function getAicsDocumentsForIngredient(ingredientName) {
  if (!ingredientName) return [];

  const sb = getPcsSupabase();
  if (sb) {
    // Case-insensitive exact match on ai_name_text. ilike with no wildcards
    // is the ANSI equivalent of LOWER(col) = LOWER(target).
    const { data, error } = await sb
      .from('aics_documents')
      .select('id, notion_page_id, aics_id, ra_review_status, ai_name_text')
      .ilike('ai_name_text', ingredientName.trim());
    if (!error) return data || [];
  }

  // Notion fallback.
  if (!PCS_DB.aicsDocuments) return [];
  const res = await notion.databases.query({
    database_id: PCS_DB.aicsDocuments,
    page_size: 100,
  });
  const target = String(ingredientName).trim().toLowerCase();
  return res.results
    .filter((page) => {
      const aiName = (page.properties?.[PD.aiName]?.rich_text || [])
        .map((t) => t.plain_text).join('').trim().toLowerCase();
      return aiName === target;
    })
    .map((page) => ({
      // Shape the Notion result to match the Postgres shape so the rest
      // of the pipeline doesn't need a branch.
      id: null, // Notion fallback has no Postgres UUID
      notion_page_id: page.id,
      aics_id: (page.properties?.[PD.aicsId]?.rich_text || [])[0]?.plain_text || null,
      ra_review_status: page.properties?.[PD.raReviewStatus]?.select?.name || null,
      ai_name_text: (page.properties?.[PD.aiName]?.rich_text || [])
        .map((t) => t.plain_text).join(''),
      __notion_page: page,
    }));
}

async function getClaimsForAicsDocs(docs) {
  if (!docs.length) return [];

  const sb = getPcsSupabase();
  const haveSupabase = !!sb && docs.every((d) => d.id);

  if (haveSupabase) {
    const docUuids = docs.map((d) => d.id);
    // PostgREST embedded resources: pull prefix text + age display name in
    // one round-trip via the FK relations.
    const { data, error } = await sb
      .from('aics_claims')
      .select(`
        notion_page_id,
        claim_no,
        claim_status,
        claim_text,
        benefit_category,
        min_dose,
        min_dose_unit,
        min_dose_secondary,
        min_dose_secondary_unit,
        grade,
        fda_dshea_disclaimer_required,
        aics_document_id,
        age_group_code,
        cv_claim_prefixes ( prefix_text ),
        cv_demographics_age ( display_name )
      `)
      .in('aics_document_id', docUuids);
    if (!error) {
      // Build UUID → notion_page_id map so the returned shape uses the
      // canonical Notion-page-id format the rest of the platform uses.
      const uuidToNotionId = new Map(docs.map((d) => [d.id, d.notion_page_id]));
      return (data || []).map((row) => ({
        id: row.notion_page_id,
        claimNo: row.claim_no ?? null,
        claimStatus: row.claim_status || null,
        claimText: row.claim_text || '',
        benefitCategory: row.benefit_category || null,
        prefix: row.cv_claim_prefixes?.prefix_text || '',
        ageGroup: row.cv_demographics_age?.display_name || null,
        minDose: row.min_dose ?? null,
        minDoseUnit: row.min_dose_unit || null,
        minDoseSecondary: row.min_dose_secondary ?? null,
        minDoseSecondaryUnit: row.min_dose_secondary_unit || null,
        grade: row.grade || null,
        fdaDsheaDisclaimerRequired: !!row.fda_dshea_disclaimer_required,
        aicsDocumentId: uuidToNotionId.get(row.aics_document_id) || row.aics_document_id || null,
      }));
    }
    // Fall through to Notion if Postgres errored.
  }

  // Notion fallback — query each AICS doc's child claims by relation.
  if (!PCS_DB.aicsClaims) return [];
  const all = [];
  for (const doc of docs) {
    const docNotionId = doc.notion_page_id;
    if (!docNotionId) continue;
    const res = await notion.databases.query({
      database_id: PCS_DB.aicsClaims,
      filter: { property: PC.aicsDocument, relation: { contains: docNotionId } },
      page_size: 100,
    });
    for (const p of res.results) {
      all.push({
        id: p.id,
        claimNo: p.properties?.[PC.claimNo]?.number ?? null,
        claimStatus: p.properties?.[PC.claimStatus]?.select?.name || null,
        claimText:
          (p.properties?.[PC.claimCore]?.rich_text || []).map((t) => t.plain_text).join('') ||
          p.properties?.[PC.claimText]?.title?.[0]?.plain_text ||
          '',
        benefitCategory: p.properties?.[PC.benefitCategory]?.select?.name || null,
        prefix: (p.properties?.[PC.claimPrefix]?.rich_text || [])
          .map((t) => t.plain_text).join(''),
        ageGroup: p.properties?.[PC.ageGroup]?.select?.name || null,
        minDose: p.properties?.[PC.minDose]?.number ?? null,
        minDoseUnit: p.properties?.[PC.minDoseUnit]?.select?.name || null,
        minDoseSecondary: p.properties?.[PC.minDoseSecondary]?.number ?? null,
        minDoseSecondaryUnit: p.properties?.[PC.minDoseSecondaryUnit]?.select?.name || null,
        grade: p.properties?.[PC.grade]?.select?.name || null,
        fdaDsheaDisclaimerRequired: p.properties?.[PC.fdaDsheaDisclaimerRequired]?.checkbox || false,
        aicsDocumentId: (p.properties?.[PC.aicsDocument]?.relation || [])[0]?.id || null,
      });
    }
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
    id: d.notion_page_id,
    aicsId: d.aics_id || null,
    raReviewStatus: d.ra_review_status || null,
    // `version` lived in a sibling Notion DB; tracking it is a future
    // enhancement (would require joining aics_versions on latest_version_id).
    version: null,
  }));

  const claims = await getClaimsForAicsDocs(aicsDocs);

  // Group by ageGroup. "Unspecified" bucket for claims with no ageGroup set.
  const byAgeGroup = {};
  for (const c of claims) {
    const key = c.ageGroup || 'Unspecified';
    (byAgeGroup[key] ||= []).push(c);
  }
  // Sort each group by minDose ascending (null doses to the bottom).
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
