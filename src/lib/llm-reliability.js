/**
 * LLM Reliability Metrics
 *
 * Three κ statistics specific to evaluating an LLM-as-rater:
 *   1. Repetition κ           — intra-model determinism (Atil 2024 arXiv:2408.04667)
 *   2. Position-shuffle κ     — robustness to question ordering (Shi 2024 arXiv:2406.07791)
 *   3. Gold-standard κ        — accuracy vs. consensus answer key
 *
 * All three reduce to multi-rater categorical agreement on the same set of
 * "items" (rubric questions). We compute Fleiss' κ across the runs because it
 * generalizes to N≥2 raters and matches what the rest of the platform reports.
 *
 * A "run" here is an object whose keys are rubric question IDs (q1, q2, ...)
 * and whose values are the categorical answer (the LLM's notionValue string,
 * or any stable label). The functions don't care what the labels are — only
 * whether they match across runs.
 */

const SCORE_THRESHOLDS = {
  STABLE: 0.75, // repetition / position-shuffle / gold-standard pass-fail line
};

function interpretKappa(k) {
  if (k == null || Number.isNaN(k)) return 'N/A';
  if (k > 0.81) return 'Almost Perfect';
  if (k > 0.61) return 'Substantial';
  if (k > 0.41) return 'Moderate';
  if (k > 0.21) return 'Fair';
  return 'Slight';
}

function statusForKappa(k) {
  if (k == null || Number.isNaN(k)) return 'unknown';
  if (k >= SCORE_THRESHOLDS.STABLE) return 'pass';        // green
  if (k >= 0.6) return 'warn';                            // yellow
  return 'fail';                                          // red
}

/**
 * Core Fleiss' κ over a matrix of categorical answers.
 *
 * @param {Array<Object>} runs - each run is { qId: categoryLabel, ... }
 * @param {Array<string>} questionIds - the items to score over
 * @returns {{ kappa: number, perItem: Object, raters: number, items: number }}
 */
function fleissKappaForRuns(runs, questionIds) {
  if (!Array.isArray(runs) || runs.length < 2) {
    return { kappa: null, perItem: {}, raters: runs?.length || 0, items: questionIds.length };
  }
  const N = questionIds.length;     // subjects (rubric items)
  const n = runs.length;            // raters (runs)
  if (N === 0) return { kappa: null, perItem: {}, raters: n, items: 0 };

  // Discover the category set per item across runs
  const perItem = {};
  let sumPi = 0;
  const globalCategoryCounts = {};
  let totalRatings = 0;

  for (const qId of questionIds) {
    const counts = {};
    let itemRatings = 0;
    for (const run of runs) {
      const v = run?.[qId];
      if (v == null) continue;
      counts[v] = (counts[v] || 0) + 1;
      itemRatings++;
    }

    // Pi: agreement for this item
    let pairAgreements = 0;
    for (const c of Object.keys(counts)) {
      pairAgreements += counts[c] * (counts[c] - 1);
    }
    const pi = itemRatings > 1 ? pairAgreements / (itemRatings * (itemRatings - 1)) : 0;
    sumPi += pi;

    for (const c of Object.keys(counts)) {
      globalCategoryCounts[c] = (globalCategoryCounts[c] || 0) + counts[c];
    }
    totalRatings += itemRatings;

    perItem[qId] = {
      pi: Math.round(pi * 1000) / 1000,
      counts,
      raters: itemRatings,
      unanimous: Object.keys(counts).length === 1,
    };
  }

  const Pbar = sumPi / N;
  let Pe = 0;
  if (totalRatings > 0) {
    for (const c of Object.keys(globalCategoryCounts)) {
      const pj = globalCategoryCounts[c] / totalRatings;
      Pe += pj * pj;
    }
  }

  let kappa;
  if (Pe === 1) {
    // Everyone gave the same category → perfect agreement, undefined denominator.
    // Convention: report κ = 1 (matches statistics.js Fleiss handling).
    kappa = 1;
  } else {
    kappa = (Pbar - Pe) / (1 - Pe);
  }

  return {
    kappa: Math.round(kappa * 1000) / 1000,
    perItem,
    raters: n,
    items: N,
  };
}

/**
 * Repetition κ — N reruns of the same study with identical inputs.
 * Measures intra-model determinism. Should be ~1.0 for a truly deterministic
 * model (T=0, fixed seed); often < 1.0 due to GPU float non-associativity
 * (Atil 2024).
 *
 * @param {Array<Object>} runs - each run is { q1: '...', q2: '...', ... }
 * @returns {Object} - { kappa, interpretation, status, perItem, ... }
 */
export function computeRepetitionKappa(runs) {
  if (!Array.isArray(runs) || runs.length < 2) {
    return {
      kappa: null,
      interpretation: 'N/A',
      status: 'unknown',
      raters: runs?.length || 0,
      items: 0,
      perItem: {},
      threshold: SCORE_THRESHOLDS.STABLE,
      mode: 'repetition',
      message: 'Need at least 2 runs for repetition κ.',
    };
  }
  const questionIds = inferQuestionIds(runs);
  const result = fleissKappaForRuns(runs, questionIds);
  return {
    ...result,
    interpretation: interpretKappa(result.kappa),
    status: statusForKappa(result.kappa),
    threshold: SCORE_THRESHOLDS.STABLE,
    mode: 'repetition',
  };
}

/**
 * Position-shuffle κ — two runs of the same study where rubric items are
 * presented in different orders in the prompt. Measures position bias.
 *
 * Since both runs cover the same item set, this reduces to Fleiss' κ
 * across two raters (which equals Cohen's κ in the symmetric case).
 *
 * @param {Object} run1 - { q1, q2, ... }
 * @param {Object} run2 - { q1, q2, ... }
 * @returns {Object} - { kappa, interpretation, status, ... }
 */
export function computePositionShuffleKappa(run1, run2) {
  if (!run1 || !run2) {
    return {
      kappa: null,
      interpretation: 'N/A',
      status: 'unknown',
      raters: 0,
      items: 0,
      perItem: {},
      threshold: SCORE_THRESHOLDS.STABLE,
      mode: 'position-shuffle',
      message: 'Need both runs for position-shuffle κ.',
    };
  }
  const runs = [run1, run2];
  const questionIds = inferQuestionIds(runs);
  const result = fleissKappaForRuns(runs, questionIds);
  return {
    ...result,
    interpretation: interpretKappa(result.kappa),
    status: statusForKappa(result.kappa),
    threshold: SCORE_THRESHOLDS.STABLE,
    mode: 'position-shuffle',
  };
}

/**
 * Gold-standard κ — LLM run(s) compared against a consensus-scored "answer
 * key" study. The gold scores are treated as one rater; each LLM run is
 * another rater, and we compute multi-rater Fleiss' κ across all of them.
 *
 * @param {Array<Object>} llmRuns - one or more LLM runs, each { q1, q2, ... }
 * @param {Object} goldScores - { q1, q2, ... }
 * @returns {Object} - { kappa, interpretation, status, perItem, ... }
 */
export function computeGoldStandardKappa(llmRuns, goldScores) {
  if (!Array.isArray(llmRuns) || llmRuns.length === 0 || !goldScores) {
    return {
      kappa: null,
      interpretation: 'N/A',
      status: 'unknown',
      raters: 0,
      items: 0,
      perItem: {},
      threshold: SCORE_THRESHOLDS.STABLE,
      mode: 'gold-standard',
      message: 'Need gold scores plus at least one LLM run.',
    };
  }
  const allRuns = [goldScores, ...llmRuns];
  const questionIds = inferQuestionIds(allRuns);
  const result = fleissKappaForRuns(allRuns, questionIds);

  // Per-item exact-match rate vs. gold (useful in the UI even when κ is
  // undefined for a particular question).
  const exactMatchPerItem = {};
  for (const qId of questionIds) {
    const goldVal = goldScores[qId];
    if (goldVal == null) continue;
    let matches = 0;
    let counted = 0;
    for (const run of llmRuns) {
      const v = run?.[qId];
      if (v == null) continue;
      counted++;
      if (v === goldVal) matches++;
    }
    exactMatchPerItem[qId] = {
      gold: goldVal,
      matchRate: counted > 0 ? Math.round((matches / counted) * 1000) / 1000 : null,
      runs: counted,
    };
  }

  return {
    ...result,
    interpretation: interpretKappa(result.kappa),
    status: statusForKappa(result.kappa),
    threshold: SCORE_THRESHOLDS.STABLE,
    mode: 'gold-standard',
    exactMatchPerItem,
    llmRunCount: llmRuns.length,
  };
}

/**
 * Discover the union of question IDs present across runs.
 * Stable: sorted by numeric suffix when keys are like q1, q2, ...
 */
function inferQuestionIds(runs) {
  const set = new Set();
  for (const run of runs) {
    if (!run) continue;
    for (const k of Object.keys(run)) {
      // Skip non-rubric-item bookkeeping keys
      if (/^q\d+$/i.test(k)) set.add(k.toLowerCase());
    }
  }
  const ids = Array.from(set);
  ids.sort((a, b) => {
    const na = parseInt(a.slice(1), 10);
    const nb = parseInt(b.slice(1), 10);
    return na - nb;
  });
  return ids;
}

export { SCORE_THRESHOLDS, interpretKappa, statusForKappa };
