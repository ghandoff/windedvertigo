/**
 * AICS-scoped claim matcher — Migration 022 / AICS Backfill Redesign
 *
 * Maps a PCS claim to the most likely AICS claim for that ingredient.
 * Replaces the generic canonical-claim-matcher.js for ingredients that
 * have an approved AICS document.
 *
 * Algorithm:
 *   1. Resolve the ingredient for a PCS claim:
 *        pcs_claim.pcsVersionId → formula_lines → activeIngredientCanonicalId
 *        → pcs_ingredients (canonicalName)
 *   2. Find AICS document(s) for that ingredient via aiName fuzzy match.
 *      Only considers AICS documents with raReviewStatus === 'Approved'.
 *   3. Fetch AICS claims from the latest version of each matching document.
 *   4. Run normalized Levenshtein similarity between the PCS claim text and
 *      each AICS claim text. Return the best match.
 *
 * Returns a structured proposal with a hasAics flag so callers can bucket
 * "no AICS yet" claims separately from "no matching AICS claim" (which is
 * a potential compliance gap).
 */

import { normalize, similarity } from './canonical-claim-matcher.js';
import { getFormulaLinesForVersion } from './pcs-formula-lines.js';
import { getAllIngredients } from './pcs-ingredients.js';
import { getAicsDocumentsByIngredientName, getAicsClaimsForVersion } from './aics-documents.js';

// Minimum similarity score for a match to count as a proposal.
// Below this threshold the claim is "unmatched" (potential compliance gap).
const MATCH_THRESHOLD = 0.4;

// Only AICS documents with this review status are used as references.
const AICS_REFERENCE_STATUS = 'Approved';

/**
 * Match a single PCS claim to the most likely AICS claim for its ingredient.
 *
 * @param {object} pcsClaim — parsed PCS claim object (from pcs-claims.js)
 * @param {object[]} allIngredients — from getAllIngredients() (passed in to avoid N+1)
 * @param {Map<string,object[]>} aicsClaimCache — keyed by aicsDocId, avoids re-fetching
 * @returns {Promise<AicsMatchResult>}
 */
export async function matchClaimToAics(pcsClaim, allIngredients, aicsClaimCache = new Map()) {
  const result = {
    pcsClaimId: pcsClaim.id,
    pcsClaimText: pcsClaim.claim,
    ingredientId: null,
    ingredientName: null,
    hasAics: false,
    aicsDocId: null,
    aicsDocDemographic: null,
    aicsClaimId: null,
    aicsClaimText: null,
    confidence: 0,
  };

  // Step 1: find the ingredient via formula lines for this claim's version
  if (!pcsClaim.pcsVersionId) return result;

  let formulaLines;
  try {
    formulaLines = await getFormulaLinesForVersion(pcsClaim.pcsVersionId);
  } catch {
    return result;
  }

  // Pick the first formula line that has a resolved canonical ingredient.
  // In practice each PCS version's claims relate to the same ingredient set.
  const linkedLine = formulaLines.find(fl => fl.activeIngredientCanonicalId);
  if (!linkedLine) return result;

  const ingredient = allIngredients.find(i => i.id === linkedLine.activeIngredientCanonicalId);
  if (!ingredient) return result;

  result.ingredientId = ingredient.id;
  result.ingredientName = ingredient.canonicalName;

  // Step 2: find AICS document(s) for this ingredient
  let aicsDocs;
  try {
    aicsDocs = await getAicsDocumentsByIngredientName(ingredient.canonicalName, {
      raReviewStatus: AICS_REFERENCE_STATUS,
    });
  } catch {
    return result;
  }

  if (!aicsDocs.length) return result; // no approved AICS yet
  result.hasAics = true;

  // Step 3: fetch AICS claims for all matching documents (cached)
  const normalizedPcsText = normalize(pcsClaim.claim);
  if (!normalizedPcsText) return result;

  let bestScore = 0;
  let bestAicsClaim = null;
  let bestAicsDoc = null;

  for (const doc of aicsDocs) {
    // Use the latestVersionId if present; fall back to first in allVersionIds
    const versionId = doc.latestVersionId || doc.allVersionIds?.[0];
    if (!versionId) continue;

    if (!aicsClaimCache.has(doc.id)) {
      try {
        const claims = await getAicsClaimsForVersion(versionId);
        aicsClaimCache.set(doc.id, claims);
      } catch {
        aicsClaimCache.set(doc.id, []);
      }
    }

    const aicsClaims = aicsClaimCache.get(doc.id) || [];

    for (const aicsClaim of aicsClaims) {
      const text = aicsClaim.claimText || aicsClaim.claimId || '';
      if (!text) continue;
      const score = similarity(normalizedPcsText, normalize(text));
      if (score > bestScore) {
        bestScore = score;
        bestAicsClaim = aicsClaim;
        bestAicsDoc = doc;
      }
    }
  }

  if (!bestAicsClaim || bestScore < MATCH_THRESHOLD) return result;

  result.aicsDocId = bestAicsDoc.id;
  result.aicsDocDemographic = bestAicsDoc.demographic;
  result.aicsClaimId = bestAicsClaim.id;
  result.aicsClaimText = bestAicsClaim.claimText || bestAicsClaim.claimId;
  result.confidence = Math.round(bestScore * 100) / 100;

  return result;
}

/**
 * Build AICS-scoped match proposals for all PCS claims that do not yet
 * have a confirmed AICS mapping (neither source_aics_claim_id nor
 * matched_aics_claim_id is set).
 *
 * Returns claim groups: claims with the same ingredient + normalized text
 * are collapsed into one group with an `instances` array. A single approval
 * can then write matched_aics_claim_id to all instances at once.
 *
 * @param {object[]} pcsClaims — from getAllClaims()
 * @returns {Promise<ClaimGroup[]>}
 */
export async function buildAicsBackfillGroups(pcsClaims) {
  // Pre-load all ingredients once
  const allIngredients = await getAllIngredients();

  // Shared cache: aicsDocId → aics claims[]
  const aicsClaimCache = new Map();

  // Process all unconfirmed claims
  const unconfirmed = pcsClaims.filter(
    c => !c.sourceAicsClaimId && !c.matchedAicsClaimId && c.claim,
  );

  const proposals = await Promise.all(
    unconfirmed.map(c => matchClaimToAics(c, allIngredients, aicsClaimCache)),
  );

  // Group by (ingredientId + normalizedClaimText)
  const groupMap = new Map();

  for (let i = 0; i < unconfirmed.length; i++) {
    const claim = unconfirmed[i];
    const proposal = proposals[i];
    const key = `${proposal.ingredientId || 'none'}::${normalize(claim.claim)}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        claimText: claim.claim,
        ingredientId: proposal.ingredientId,
        ingredientName: proposal.ingredientName,
        hasAics: proposal.hasAics,
        aicsDocId: proposal.aicsDocId,
        aicsDocDemographic: proposal.aicsDocDemographic,
        aicsClaimId: proposal.aicsClaimId,
        aicsClaimText: proposal.aicsClaimText,
        confidence: proposal.confidence,
        instances: [],
        status: deriveStatus(proposal),
      });
    }

    groupMap.get(key).instances.push({
      pcsClaimId: claim.id,
      pcsVersionId: claim.pcsVersionId,
    });
  }

  return Array.from(groupMap.values()).sort((a, b) => {
    // Sort: ingredient name → confidence desc
    const nameOrder = (a.ingredientName || '').localeCompare(b.ingredientName || '');
    if (nameOrder !== 0) return nameOrder;
    return b.confidence - a.confidence;
  });
}

/**
 * Also returns stats on already-confirmed claims for the coverage summary.
 *
 * @param {object[]} pcsClaims — full set, including confirmed
 * @returns {{ confirmedCount: number, byIngredient: Map<string,number> }}
 */
export function buildConfirmedStats(pcsClaims) {
  let confirmedCount = 0;
  const byIngredient = new Map();
  for (const c of pcsClaims) {
    if (c.sourceAicsClaimId || c.matchedAicsClaimId) {
      confirmedCount++;
    }
  }
  return { confirmedCount, total: pcsClaims.length };
}

function deriveStatus(proposal) {
  if (!proposal.ingredientId) return 'no-ingredient';
  if (!proposal.hasAics) return 'no-aics';
  if (!proposal.aicsClaimId) return 'unmatched';
  if (proposal.confidence >= 0.6) return 'pending';
  return 'low-confidence';
}
