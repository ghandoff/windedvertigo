/**
 * NutriGrade-style body-of-evidence certainty scoring.
 *
 * For each PCS claim, aggregates the supporting evidence into a single
 * 0-10 confidence score + categorical rating (High / Moderate / Low /
 * Very Low / Pending).
 *
 * Reference: Schwingshackl L, Knüppel S, Schwedhelm C, et al.
 *   NutriGrade: A scoring system to assess and judge the meta-evidence
 *   of randomized controlled trials and cohort studies in nutrition
 *   research. Adv Nutr 2016;7(6):994-1004.
 *   DOI: 10.3945/an.116.013052. PMID: 28140319.
 *
 * Published-grade reliability: mean item κ = 0.66, ICC = 0.81.
 *
 * This implementation is inspired by NutriGrade but adapted to
 * Nordic's existing data:
 *   • Study quality      (0–3 pts) — derived from SQR rubric mean
 *                          (17+ = 3, 11–16 = 2, <11 = 1, no-data = 0)
 *   • Directness         (0–2 pts) — derived from applicability mean
 *                          (8+ = 2, 5–7 = 1, <5 = 0)
 *   • Heterogeneity      (0–1 pts) — RA input (Low=1, Mod=0.5, High=0)
 *   • Publication bias   (0–1 pts) — RA input (Undetected=1, Suspected=0.5, Detected=0)
 *   • Funding bias       (0–1 pts) — RA input (Independent=1, Mixed=0.5, Industry=0)
 *   • Precision          (0–1 pts) — RA input (Precise=1, Mod=0.5, Imprecise=0)
 *   • Effect size        (0–1 pt upgrade) — Large=1, Moderate=0.5, else 0
 *   • Dose-response      (0–1 pt upgrade) — Present=1, else 0
 *
 * Maximum raw total: 11 (capped at 10).
 *
 * Rating thresholds (per Schwingshackl 2016 Table 2):
 *   High      ≥ 8.0
 *   Moderate  6.0–7.99
 *   Low       4.0–5.99
 *   Very Low  < 4.0
 *
 * Single-study caveat: when supported by only one study, the rating
 * is capped at Low regardless of score — this mirrors the NutriGrade
 * "type of evidence" penalty for un-replicated findings.
 */

/**
 * Map an SQR rubric mean (0–22 scale) to 0–3 study-quality points.
 */
function studyQualityPoints(sqrMean) {
  if (sqrMean == null) return { pts: 0, note: 'No SQR score available' };
  if (sqrMean >= 17) return { pts: 3, note: `SQR mean ${sqrMean.toFixed(1)} (High tier)` };
  if (sqrMean >= 11) return { pts: 2, note: `SQR mean ${sqrMean.toFixed(1)} (Moderate tier)` };
  return { pts: 1, note: `SQR mean ${sqrMean.toFixed(1)} (Low tier)` };
}

/**
 * Map an applicability mean (0–10 scale) to 0–2 directness points.
 */
function directnessPoints(applicabilityMean) {
  if (applicabilityMean == null) return { pts: 0, note: 'No applicability assessments' };
  if (applicabilityMean >= 8) return { pts: 2, note: `Applicability ${applicabilityMean.toFixed(1)} (High directness)` };
  if (applicabilityMean >= 5) return { pts: 1, note: `Applicability ${applicabilityMean.toFixed(1)} (Moderate directness)` };
  return { pts: 0, note: `Applicability ${applicabilityMean.toFixed(1)} (Low directness — no points awarded)` };
}

const RA_INPUT_POINTS = Object.freeze({
  heterogeneity: { 'Low': 1, 'Moderate': 0.5, 'High': 0 },
  publicationBias: { 'Undetected': 1, 'Suspected': 0.5, 'Detected': 0 },
  fundingBias: { 'Independent': 1, 'Mixed': 0.5, 'Industry': 0 },
  precision: { 'Precise': 1, 'Moderate': 0.5, 'Imprecise': 0 },
});

const UPGRADE_POINTS = Object.freeze({
  effectSizeCategory: { 'Large': 1, 'Moderate': 0.5 },
  doseResponseGradient: { 'Present': 1 },
});

/**
 * Compute the certainty score and rating for a claim.
 *
 * @param {Object} inputs
 * @param {number|null} inputs.sqrMean - Mean SQR rubric total (0-22) across supporting studies
 * @param {number|null} inputs.applicabilityMean - Mean applicability score (0-10) across (study × claim) pairs
 * @param {number} inputs.evidenceCount - Number of linked evidence items
 * @param {string|null} inputs.heterogeneity - 'Low' | 'Moderate' | 'High' | 'Unknown' | null
 * @param {string|null} inputs.publicationBias - 'Undetected' | 'Suspected' | 'Detected' | 'Unknown' | null
 * @param {string|null} inputs.fundingBias - 'Independent' | 'Mixed' | 'Industry' | 'Unknown' | null
 * @param {string|null} inputs.precision - 'Precise' | 'Moderate' | 'Imprecise' | 'Unknown' | null
 * @param {string|null} inputs.effectSizeCategory - 'Large' | 'Moderate' | 'Small' | 'Null' | 'Unknown' | null
 * @param {string|null} inputs.doseResponseGradient - 'Present' | 'Absent' | 'Unclear' | null
 * @returns {Object} { score, rating, breakdown: [{ label, pts, note }] }
 */
export function computeCertainty(inputs) {
  const {
    sqrMean = null,
    applicabilityMean = null,
    evidenceCount = 0,
    heterogeneity = null,
    publicationBias = null,
    fundingBias = null,
    precision = null,
    effectSizeCategory = null,
    doseResponseGradient = null,
  } = inputs || {};

  if (evidenceCount === 0) {
    return {
      score: null,
      rating: 'Pending',
      breakdown: [{ label: 'Evidence count', pts: 0, note: 'No evidence linked to this claim yet' }],
      cappedAt: null,
      evidenceCount: 0,
    };
  }

  const breakdown = [];
  let total = 0;

  // Base points
  const sq = studyQualityPoints(sqrMean);
  breakdown.push({ label: 'Study quality (SQR)', pts: sq.pts, max: 3, note: sq.note });
  total += sq.pts;

  const dr = directnessPoints(applicabilityMean);
  breakdown.push({ label: 'Directness (applicability)', pts: dr.pts, max: 2, note: dr.note });
  total += dr.pts;

  // RA inputs (4 items, max 1 pt each)
  const raInputs = [
    { key: 'heterogeneity', label: 'Heterogeneity', value: heterogeneity },
    { key: 'publicationBias', label: 'Publication bias', value: publicationBias },
    { key: 'fundingBias', label: 'Funding bias', value: fundingBias },
    { key: 'precision', label: 'Precision', value: precision },
  ];
  for (const { key, label, value } of raInputs) {
    if (!value || value === 'Unknown') {
      breakdown.push({ label, pts: 0, max: 1, note: value === 'Unknown' ? 'Unknown — no points awarded' : 'Not yet assessed' });
      continue;
    }
    const pts = RA_INPUT_POINTS[key][value] ?? 0;
    breakdown.push({ label, pts, max: 1, note: `${value} (+${pts})` });
    total += pts;
  }

  // Upgrade factors (2 items, max 1 pt each)
  if (effectSizeCategory && effectSizeCategory !== 'Unknown') {
    const pts = UPGRADE_POINTS.effectSizeCategory[effectSizeCategory] ?? 0;
    breakdown.push({ label: 'Effect size (upgrade)', pts, max: 1, note: `${effectSizeCategory} (+${pts})` });
    total += pts;
  } else {
    breakdown.push({ label: 'Effect size (upgrade)', pts: 0, max: 1, note: 'Not assessed' });
  }
  if (doseResponseGradient && doseResponseGradient !== 'Unclear') {
    const pts = UPGRADE_POINTS.doseResponseGradient[doseResponseGradient] ?? 0;
    breakdown.push({ label: 'Dose-response (upgrade)', pts, max: 1, note: `${doseResponseGradient} (+${pts})` });
    total += pts;
  } else {
    breakdown.push({ label: 'Dose-response (upgrade)', pts: 0, max: 1, note: doseResponseGradient || 'Not assessed' });
  }

  // Cap total at 10
  let score = Math.min(10, total);

  // Round to one decimal up-front so subsequent threshold comparisons
  // are against the same number the user sees on screen.
  score = Math.round(score * 10) / 10;

  // Single-study cap: one study can never reach Moderate or higher.
  // NutriGrade's "type of evidence" penalty: un-replicated findings
  // top out at Low (< 6.0) regardless of other merits.
  let cappedAt = null;
  if (evidenceCount === 1 && score >= 6) {
    cappedAt = 5.9;
    score = 5.9;
    breakdown.push({ label: 'Single-study cap', pts: 0, max: 0, note: 'Capped at 5.9 (Low) because only one study supports this claim' });
  }

  // Rating thresholds
  let rating;
  if (score >= 8) rating = 'High';
  else if (score >= 6) rating = 'Moderate';
  else if (score >= 4) rating = 'Low';
  else rating = 'Very Low';

  return { score, rating, breakdown, cappedAt, evidenceCount };
}
