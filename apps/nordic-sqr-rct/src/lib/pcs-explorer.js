/**
 * Budget C Preview — Marketing Intelligence Interface data layer.
 *
 * Read-only join across existing pcs-* helpers. Does NOT touch the data
 * model — only reads from already-cached Notion/Postgres helpers.
 *
 * Three lenses:
 *   queryByBenefitCategory(id) — "Which ingredients/products support [Eye Health]?"
 *   queryByIngredient(id)      — "What can [Magnesium] support, and at what dose?"
 *   queryByProduct(documentId) — "What claims can [product] make?"
 *
 * Each lens returns ExplorerRow[]:
 *   { claim, ingredient, dose, benefitCategory, evidenceCount, status, statusInputs, pcsRef }
 *
 * Substantiation status is derived transparently — thresholds in
 * SUBSTANTIATION_THRESHOLDS so they're easy to tune with Sharon.
 */

import { getAllClaims } from './pcs-claims.js';
import { getAllCanonicalClaims } from './pcs-canonical-claims.js';
import { getAllEvidencePackets } from './pcs-evidence-packets.js';
import { getAllEvidence } from './pcs-evidence.js';
import { getAllScores } from './sqr-scores.js';
import { getAllIngredients } from './pcs-ingredients.js';
import { getAllBenefitCategories } from './pcs-benefit-categories.js';
import { getAllDocuments } from './pcs-documents.js';

// ─── Substantiation thresholds ────────────────────────────────────────────
// Tunable: update these numbers after Sharon reviews the first demo pass.
// Scores are SQR-RCT normalized 0–1: (sum(Q1..Q11) - 11) / 22
//   where each Q is scored 1–3 by the external reviewer.
export const SUBSTANTIATION_THRESHOLDS = Object.freeze({
  // Minimum number of supporting studies to reach "Supported"
  SUPPORTED_MIN_STUDIES: 2,
  // Minimum mean SQR-RCT normalized score for "Supported"
  SUPPORTED_MIN_SCORE: 0.70,
  // Minimum mean SQR-RCT normalized score for "Thin" (below → "Unsupported")
  THIN_MIN_SCORE: 0.50,
  // With 0 studies → always "Unsupported"
});

// ─── Normalize a single SQR-RCT score object → 0–1 ──────────────────────
// Q1..Q11 are each 1, 2, or 3. Min sum = 11, max sum = 33, range = 22.
export function normalizeSqrScore(score) {
  const qs = [
    score.q1, score.q2, score.q3, score.q4, score.q5, score.q6,
    score.q7, score.q8, score.q9, score.q10, score.q11,
  ];
  const filled = qs.filter(q => q !== null && q !== undefined);
  if (filled.length === 0) return null;
  const sum = filled.reduce((a, b) => a + b, 0);
  // Normalize: if not all 11 Qs answered, scale to the answered range
  const min = filled.length;
  const max = filled.length * 3;
  return (sum - min) / (max - min);
}

// ─── Derive substantiation status ─────────────────────────────────────────
// Returns { status, evidenceCount, meanScore, inputs }
// status: 'Supported' | 'Thin' | 'Unsupported'
export function computeSubstantiationStatus(evidenceItems, scores) {
  const t = SUBSTANTIATION_THRESHOLDS;
  const count = evidenceItems.length;

  // Collect all SQR-RCT scores for these evidence items
  const evidenceIds = new Set(evidenceItems.map(e => e.id));
  const relevantScores = scores.filter(s =>
    (s.studyRelation || []).some(id => evidenceIds.has(id))
  );
  const normalizedScores = relevantScores
    .map(normalizeSqrScore)
    .filter(s => s !== null);

  const meanScore = normalizedScores.length > 0
    ? normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length
    : null;

  let status;
  if (count === 0) {
    status = 'Unsupported';
  } else if (meanScore !== null && meanScore < t.THIN_MIN_SCORE) {
    status = 'Unsupported';
  } else if (count >= t.SUPPORTED_MIN_STUDIES && meanScore !== null && meanScore >= t.SUPPORTED_MIN_SCORE) {
    status = 'Supported';
  } else {
    status = 'Thin';
  }

  return {
    status,
    evidenceCount: count,
    meanScore: meanScore !== null ? Math.round(meanScore * 100) / 100 : null,
    scoreCount: normalizedScores.length,
  };
}

// ─── Build the in-memory join index ──────────────────────────────────────
// Loads all data in parallel and assembles the cross-table indexes needed
// for the three lenses. Returns an ExplorerIndex object.
export async function buildExplorerIndex() {
  const [
    claims,
    canonicalClaims,
    packets,
    evidence,
    scores,
    ingredients,
    benefitCategories,
    documents,
  ] = await Promise.all([
    getAllClaims(),
    getAllCanonicalClaims(),
    getAllEvidencePackets(),
    getAllEvidence(),
    getAllScores(),
    getAllIngredients(),
    getAllBenefitCategories(),
    getAllDocuments(),
  ]);

  // Build lookup maps
  const canonicalById = new Map(canonicalClaims.map(c => [c.id, c]));
  const evidenceById = new Map(evidence.map(e => [e.id, e]));
  const ingredientById = new Map(ingredients.map(i => [i.id, i]));
  const benefitCategoryById = new Map(benefitCategories.map(b => [b.id, b]));
  const documentById = new Map(documents.map(d => [d.id, d]));

  // Build evidence packet index: claimId → evidence items
  const packetsByClaimId = new Map();
  for (const packet of packets) {
    if (!packet.pcsClaimId) continue;
    if (!packetsByClaimId.has(packet.pcsClaimId)) {
      packetsByClaimId.set(packet.pcsClaimId, []);
    }
    packetsByClaimId.get(packet.pcsClaimId).push(packet);
  }

  return {
    claims,
    canonicalById,
    evidenceById,
    ingredientById,
    benefitCategoryById,
    documentById,
    packetsByClaimId,
    scores,
  };
}

// ─── Build a single ExplorerRow from a claim + index ────────────────────
function buildRow(claim, index) {
  const { canonicalById, evidenceById, ingredientById, benefitCategoryById,
          documentById, packetsByClaimId, scores } = index;

  const canonical = claim.canonicalClaimId
    ? canonicalById.get(claim.canonicalClaimId) || null
    : null;

  const ingredient = canonical?.activeIngredientId
    ? ingredientById.get(canonical.activeIngredientId) || null
    : null;

  const benefitCategory = canonical?.benefitCategoryId
    ? benefitCategoryById.get(canonical.benefitCategoryId) || null
    : null;

  // Collect linked evidence items
  const claimPackets = packetsByClaimId.get(claim.id) || [];
  const evidenceItems = claimPackets
    .map(p => p.evidenceItemId ? evidenceById.get(p.evidenceItemId) : null)
    .filter(Boolean);

  const substantiation = computeSubstantiationStatus(evidenceItems, scores);

  // Dose: prefer claim's own dose fields, fall back to packet study dose
  const minDose = claim.minDoseMg ?? null;
  const maxDose = claim.maxDoseMg ?? null;
  const doseLabel = minDose !== null
    ? (maxDose !== null && maxDose !== minDose
        ? `${minDose}–${maxDose} mg`
        : `${minDose} mg`)
    : null;

  // PCS document reference via pcs version
  const pcsVersionId = claim.pcsVersionId || null;

  return {
    claimId: claim.id,
    claimText: claim.claim || '',
    claimBucket: claim.claimBucket || null,
    claimStatus: claim.claimStatus || null,
    ingredient: ingredient ? { id: ingredient.id, name: ingredient.canonicalName || ingredient.name || '' } : null,
    dose: doseLabel,
    minDoseMg: minDose,
    maxDoseMg: maxDose,
    benefitCategory: benefitCategory ? { id: benefitCategory.id, name: benefitCategory.benefitCategory || benefitCategory.name || '' } : null,
    evidenceCount: substantiation.evidenceCount,
    status: substantiation.status,
    statusInputs: {
      evidenceCount: substantiation.evidenceCount,
      meanScore: substantiation.meanScore,
      scoreCount: substantiation.scoreCount,
    },
    canonicalClaimId: canonical?.id || null,
    canonicalClaimText: canonical?.canonicalClaim || null,
    pcsVersionId,
    pcsRef: pcsVersionId ? `/research/pcs/documents` : null,
  };
}

// ─── Three query lenses ──────────────────────────────────────────────────

export async function queryByBenefitCategory(benefitCategoryId) {
  const index = await buildExplorerIndex();
  const { claims, canonicalById } = index;

  const matching = claims.filter(claim => {
    if (!claim.canonicalClaimId) return false;
    const canonical = canonicalById.get(claim.canonicalClaimId);
    return canonical?.benefitCategoryId === benefitCategoryId;
  });

  return matching.map(c => buildRow(c, index));
}

export async function queryByIngredient(ingredientId) {
  const index = await buildExplorerIndex();
  const { claims, canonicalById } = index;

  const matching = claims.filter(claim => {
    if (!claim.canonicalClaimId) return false;
    const canonical = canonicalById.get(claim.canonicalClaimId);
    return canonical?.activeIngredientId === ingredientId;
  });

  return matching.map(c => buildRow(c, index));
}

export async function queryByProduct(documentId) {
  const index = await buildExplorerIndex();
  // Documents → versions → claims: claims carry pcsVersionId.
  // We filter claims whose parent version's document matches documentId.
  // Since we don't have a version→document map here, we load documents
  // and match via the existing document records.
  const { claims, documentById } = index;

  // Build a simple check: the claim's pcsVersionId appears as a version
  // of the requested document. We pull versionsIds from the document record.
  const doc = documentById.get(documentId);
  if (!doc) return [];

  // pcs document has a versions relation (array of version page IDs)
  const versionIds = new Set(doc.versions || doc.pcsVersionIds || []);

  const matching = claims.filter(claim =>
    claim.pcsVersionId && versionIds.has(claim.pcsVersionId)
  );

  return matching.map(c => buildRow(c, index));
}

// ─── Filter options (for UI dropdowns) ──────────────────────────────────
// Returns the available options for each lens so the UI can populate
// its selects without hitting the heavy buildExplorerIndex path.
export async function getExplorerOptions() {
  const [benefitCategories, ingredients, documents] = await Promise.all([
    getAllBenefitCategories(),
    getAllIngredients(),
    getAllDocuments(),
  ]);

  return {
    benefitCategories: benefitCategories.map(b => ({
      id: b.id,
      name: b.benefitCategory || b.name || '',
    })).sort((a, b) => a.name.localeCompare(b.name)),

    ingredients: ingredients.map(i => ({
      id: i.id,
      name: i.canonicalName || i.name || '',
    })).sort((a, b) => a.name.localeCompare(b.name)),

    documents: documents.map(d => ({
      id: d.id,
      name: d.finishedGoodName || d.pcsId || d.id,
      pcsId: d.pcsId || '',
    })).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
  };
}
