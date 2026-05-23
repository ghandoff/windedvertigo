/**
 * pcs.js — thin delegate to pcs-evidence + pcs-evidence-packets.
 *
 * Part 10 cleanup (2026-05-23): this file used to be a parallel Notion
 * implementation of Evidence Library + Evidence Packets CRUD. It has been
 * fully superseded by `pcs-evidence.js` and `pcs-evidence-packets.js`,
 * both of which are Postgres-first with Notion fire-and-forget mirrors.
 *
 * Kept as a slim compatibility layer for legacy callers that still use the
 * older function names. Each export delegates to the canonical lib so the
 * Notion-free guarantee from those modules transitively applies here.
 *
 * Callers should migrate to the canonical libs directly; new code MUST NOT
 * import from this file.
 */

import {
  getAllEvidence,
  getUntaggedEvidence as getUntaggedEvidenceCanonical,
  updateEvidence,
} from './pcs-evidence.js';
import {
  getPacketsForEvidenceItem,
  updateEvidencePacket,
} from './pcs-evidence-packets.js';

// ─── Evidence Library ────────────────────────────────────────────────

/** @deprecated use `getAllEvidence()` from `pcs-evidence.js` */
export async function getAllEvidenceEntries() {
  return getAllEvidence();
}

/**
 * @deprecated use `updateEvidence(id, { sqrScore, sqrRiskOfBias, sqrReviewDate, sqrReviewUrl, sqrReviewed })`
 * @param {string} pageId
 * @param {{ score: number, riskOfBias: string, reviewDate: string, reviewUrl: string }} fields
 */
export async function updateEvidenceEntry(pageId, { score, riskOfBias, reviewDate, reviewUrl }) {
  return updateEvidence(pageId, {
    sqrScore: score,
    sqrRiskOfBias: riskOfBias,
    sqrReviewDate: reviewDate,
    sqrReviewUrl: reviewUrl,
    sqrReviewed: true,
  });
}

// ─── Ingredient Backfill ─────────────────────────────────────────────

/** @deprecated use `getUntaggedEvidence()` from `pcs-evidence.js` */
export async function getUntaggedEvidence() {
  return getUntaggedEvidenceCanonical();
}

/**
 * @deprecated use `updateEvidence(id, { ingredients })`
 * @param {string} pageId
 * @param {string[]} ingredients
 */
export async function updateEvidenceIngredients(pageId, ingredients) {
  return updateEvidence(pageId, { ingredients });
}

// ─── Evidence Packets ────────────────────────────────────────────────

/** @deprecated use `getPacketsForEvidenceItem()` from `pcs-evidence-packets.js` */
export async function getPacketsForEvidence(evidencePageId) {
  return getPacketsForEvidenceItem(evidencePageId);
}

/**
 * @deprecated use `updateEvidencePacket(id, { meetsThreshold })`
 */
export async function updatePacketThreshold(packetId, meetsThreshold) {
  return updateEvidencePacket(packetId, { meetsThreshold });
}
