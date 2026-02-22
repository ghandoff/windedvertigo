/**
 * Inter-Rater Reliability (IRR) and analytics calculations
 * for the SQR-RCT Platform
 */

const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];
const QUESTION_LABELS = {
  q1: 'Research Question', q2: 'Randomization', q3: 'Blinding',
  q4: 'Sample Size', q5: 'Baseline Characteristics', q6: 'Participant Flow',
  q7: 'Intervention Description', q8: 'Outcome Measurement', q9: 'Statistical Analysis',
  q10: 'Bias Assessment', q11: 'Applicability',
};
const SCORE_OPTIONS = [0, 1, 2];

function getTotal(score) {
  return QUESTION_IDS.reduce((sum, q) => sum + (score[q] ?? 0), 0);
}

function getQualityTierLabel(total) {
  if (total >= 17) return 'High';
  if (total >= 11) return 'Moderate';
  return 'Low';
}

function interpretKappa(k) {
  if (k > 0.81) return 'Almost Perfect';
  if (k > 0.61) return 'Substantial';
  if (k > 0.41) return 'Moderate';
  if (k > 0.21) return 'Fair';
  return 'Slight';
}

/**
 * PABAK = 2 * Po - 1
 * Prevalence-Adjusted Bias-Adjusted Kappa (Byrt et al., 1993)
 * Corrects for the paradox where high agreement + skewed prevalence = low kappa
 */
function pabak(arr1, arr2) {
  const n = arr1.length;
  if (n === 0) return null;
  const matches = arr1.filter((v, i) => v === arr2[i]).length;
  const po = matches / n;
  return 2 * po - 1;
}

/**
 * ICC(2,1) — Two-way random, single measures, absolute agreement
 * Shrout & Fleiss (1979) formulation for total scores across raters
 */
export function calculateICC(articleScoresMap) {
  // Build matrix: rows = articles, columns = raters (only articles with 2+ raters)
  const eligible = Object.entries(articleScoresMap)
    .filter(([, scores]) => scores.length >= 2);

  if (eligible.length < 2) return null;

  // Get consistent rater count (use articles with the most common rater count)
  const raterCounts = eligible.map(([, s]) => s.length);
  const modeCount = raterCounts.sort((a, b) =>
    raterCounts.filter(v => v === b).length - raterCounts.filter(v => v === a).length
  )[0];

  // Filter to articles with exactly modeCount raters for balanced ICC
  const balanced = eligible.filter(([, s]) => s.length === modeCount);
  if (balanced.length < 2) return null;

  const n = balanced.length;      // number of subjects (articles)
  const k = modeCount;            // number of raters

  // Build score matrix (total scores)
  const matrix = balanced.map(([, scores]) =>
    scores.map(s => getTotal(s))
  );

  // Grand mean
  const allValues = matrix.flat();
  const grandMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;

  // Row means (article means)
  const rowMeans = matrix.map(row => row.reduce((a, b) => a + b, 0) / row.length);

  // Column means (rater means)
  const colMeans = [];
  for (let j = 0; j < k; j++) {
    colMeans.push(matrix.reduce((sum, row) => sum + row[j], 0) / n);
  }

  // SS Between subjects (rows)
  const SSR = k * rowMeans.reduce((sum, rm) => sum + Math.pow(rm - grandMean, 2), 0);

  // SS Between raters (columns)
  const SSC = n * colMeans.reduce((sum, cm) => sum + Math.pow(cm - grandMean, 2), 0);

  // SS Total
  const SST = allValues.reduce((sum, v) => sum + Math.pow(v - grandMean, 2), 0);

  // SS Error (residual)
  const SSE = SST - SSR - SSC;

  // Mean squares
  const MSR = SSR / (n - 1);
  const MSC = SSC / (k - 1);
  const MSE = SSE / ((n - 1) * (k - 1));

  // ICC(2,1) — two-way random, single measures, absolute agreement
  const icc = (MSR - MSE) / (MSR + (k - 1) * MSE + (k / n) * (MSC - MSE));

  return {
    icc: Math.round(icc * 1000) / 1000,
    interpretation: interpretKappa(icc), // same scale as kappa
    articlesUsed: n,
    ratersPerArticle: k,
    model: 'ICC(2,1)',
  };
}

// ─── Cohen's Kappa (pairwise, per-question and overall) ─────────────────

function cohensKappaForArray(arr1, arr2) {
  const n = arr1.length;
  if (n === 0) return null;

  const matches = arr1.filter((v, i) => v === arr2[i]).length;
  const po = matches / n;

  const freq1 = {};
  const freq2 = {};
  SCORE_OPTIONS.forEach(s => { freq1[s] = 0; freq2[s] = 0; });
  arr1.forEach(v => { freq1[v] = (freq1[v] || 0) + 1; });
  arr2.forEach(v => { freq2[v] = (freq2[v] || 0) + 1; });

  let pe = 0;
  SCORE_OPTIONS.forEach(s => {
    pe += (freq1[s] / n) * (freq2[s] / n);
  });

  if (pe === 1) return 1; // perfect expected agreement
  return (po - pe) / (1 - pe);
}

export function calculateCohensKappaPairs(scores, articleScoresMap) {
  // Get unique reviewers
  const reviewers = [...new Set(scores.map(s => s.raterAlias))].filter(Boolean);
  const pairs = [];

  for (let i = 0; i < reviewers.length; i++) {
    for (let j = i + 1; j < reviewers.length; j++) {
      const r1 = reviewers[i];
      const r2 = reviewers[j];

      // Find articles scored by both reviewers
      const sharedArticles = [];
      for (const [articleId, articleScores] of Object.entries(articleScoresMap)) {
        const s1 = articleScores.find(s => s.raterAlias === r1);
        const s2 = articleScores.find(s => s.raterAlias === r2);
        if (s1 && s2) sharedArticles.push({ s1, s2 });
      }

      if (sharedArticles.length === 0) continue;

      // Calculate per-question kappa
      const perQuestion = {};
      QUESTION_IDS.forEach(q => {
        const arr1 = sharedArticles.map(a => a.s1[q]);
        const arr2 = sharedArticles.map(a => a.s2[q]);
        perQuestion[q] = cohensKappaForArray(arr1, arr2);
      });

      // Overall kappa (across all questions and articles)
      const allArr1 = [];
      const allArr2 = [];
      QUESTION_IDS.forEach(q => {
        sharedArticles.forEach(a => {
          allArr1.push(a.s1[q]);
          allArr2.push(a.s2[q]);
        });
      });
      const overallKappa = cohensKappaForArray(allArr1, allArr2);

      // Percent agreement
      const totalComparisons = allArr1.length;
      const totalMatches = allArr1.filter((v, i) => v === allArr2[i]).length;
      const percentAgreement = totalComparisons > 0 ? (totalMatches / totalComparisons) * 100 : 0;

      // PABAK — corrects for prevalence/bias paradox
      const overallPABAK = pabak(allArr1, allArr2);

      pairs.push({
        reviewer1: r1,
        reviewer2: r2,
        sharedArticles: sharedArticles.length,
        overallKappa: overallKappa != null ? Math.round(overallKappa * 1000) / 1000 : null,
        overallPABAK: overallPABAK != null ? Math.round(overallPABAK * 1000) / 1000 : null,
        interpretation: overallKappa != null ? interpretKappa(overallKappa) : 'N/A',
        pabakInterpretation: overallPABAK != null ? interpretKappa(overallPABAK) : 'N/A',
        percentAgreement: Math.round(percentAgreement * 10) / 10,
        perQuestion,
      });
    }
  }

  return pairs;
}

// ─── Fleiss' Kappa (multi-rater agreement per question) ─────────────────

export function calculateFleissKappas(articleScoresMap) {
  // Only include articles with 2+ raters
  const eligibleArticles = Object.entries(articleScoresMap)
    .filter(([, scores]) => scores.length >= 2);

  if (eligibleArticles.length === 0) {
    return { perQuestion: {}, overall: null, eligibleArticleCount: 0 };
  }

  const perQuestion = {};

  QUESTION_IDS.forEach(q => {
    const N = eligibleArticles.length; // number of subjects (articles)
    let sumPi = 0;
    const categoryTotals = {};
    SCORE_OPTIONS.forEach(c => { categoryTotals[c] = 0; });
    let totalRatings = 0;

    eligibleArticles.forEach(([, scores]) => {
      const n = scores.length; // number of raters for this article
      const counts = {};
      SCORE_OPTIONS.forEach(c => { counts[c] = 0; });
      scores.forEach(s => {
        const val = s[q];
        if (val != null) counts[val] = (counts[val] || 0) + 1;
      });

      // Pi for this article-question: proportion of agreeing rater pairs
      let pairAgreements = 0;
      SCORE_OPTIONS.forEach(c => {
        pairAgreements += counts[c] * (counts[c] - 1);
      });
      const pi = n > 1 ? pairAgreements / (n * (n - 1)) : 0;
      sumPi += pi;

      SCORE_OPTIONS.forEach(c => {
        categoryTotals[c] += counts[c];
      });
      totalRatings += n;
    });

    const Pbar = sumPi / N;

    // Pe: expected agreement by chance
    let Pe = 0;
    SCORE_OPTIONS.forEach(c => {
      const pj = categoryTotals[c] / totalRatings;
      Pe += pj * pj;
    });

    const kappa = Pe === 1 ? 1 : (Pbar - Pe) / (1 - Pe);

    // Percent agreement for this question
    const totalComparisons = eligibleArticles.reduce((sum, [, scores]) => {
      const n = scores.length;
      return sum + (n * (n - 1)) / 2;
    }, 0);
    const agreedPairs = eligibleArticles.reduce((sum, [, scores]) => {
      const n = scores.length;
      const counts = {};
      SCORE_OPTIONS.forEach(c => { counts[c] = 0; });
      scores.forEach(s => { const v = s[q]; if (v != null) counts[v]++; });
      let pairs = 0;
      SCORE_OPTIONS.forEach(c => { pairs += (counts[c] * (counts[c] - 1)) / 2; });
      return sum + pairs;
    }, 0);
    const pctAgreement = totalComparisons > 0 ? (agreedPairs / totalComparisons) * 100 : 0;

    perQuestion[q] = {
      kappa: Math.round(kappa * 1000) / 1000,
      interpretation: interpretKappa(kappa),
      percentAgreement: Math.round(pctAgreement * 10) / 10,
      label: QUESTION_LABELS[q],
    };
  });

  // Overall Fleiss' kappa: average of per-question kappas
  const kappas = Object.values(perQuestion).map(v => v.kappa).filter(k => k != null);
  const overallKappa = kappas.length > 0
    ? Math.round((kappas.reduce((a, b) => a + b, 0) / kappas.length) * 1000) / 1000
    : null;

  return {
    perQuestion,
    overall: overallKappa,
    overallInterpretation: overallKappa != null ? interpretKappa(overallKappa) : 'N/A',
    eligibleArticleCount: eligibleArticles.length,
  };
}

// ─── Article Summaries ──────────────────────────────────────────────────

export function buildArticleSummaries(studies, articleScoresMap) {
  // Deduplicate studies by DOI (prefer entry without submittedByAlias)
  const byDoi = {};
  studies.forEach(study => {
    const doi = study.doi || study.id;
    if (!byDoi[doi] || !study.submittedByAlias) {
      byDoi[doi] = study;
    }
  });

  return Object.entries(byDoi).map(([doi, study]) => {
    // Find all scores for this study (match by any intake with same DOI)
    const studyIds = studies.filter(s => (s.doi || s.id) === doi).map(s => s.id);
    const allScores = studyIds.flatMap(id => articleScoresMap[id] || []);

    // Deduplicate scores by rater alias (keep latest)
    const byRater = {};
    allScores.forEach(s => {
      if (!byRater[s.raterAlias] || s.timestamp > byRater[s.raterAlias].timestamp) {
        byRater[s.raterAlias] = s;
      }
    });
    const uniqueScores = Object.values(byRater);

    const reviewerScores = uniqueScores.map(s => ({
      raterAlias: s.raterAlias,
      total: getTotal(s),
      ...Object.fromEntries(QUESTION_IDS.map(q => [q, s[q]])),
      timeToComplete: s.timeToComplete,
    }));

    const totals = reviewerScores.map(r => r.total);
    const avgScore = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
    const maxDifference = totals.length >= 2 ? Math.max(...totals) - Math.min(...totals) : 0;

    let consensusStatus = 'Pending';
    if (totals.length >= 2) {
      if (maxDifference <= 3) consensusStatus = 'Consensus';
      else if (maxDifference <= 6) consensusStatus = 'Moderate Spread';
      else consensusStatus = 'Conflicted';
    } else if (totals.length === 1) {
      consensusStatus = 'Single Reviewer';
    }

    return {
      id: study.id,
      citation: study.citation,
      doi: study.doi,
      year: study.year,
      journal: study.journal,
      reviewerCount: uniqueScores.length,
      reviewerScores,
      avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      avgTier: avgScore != null ? getQualityTierLabel(Math.round(avgScore)) : null,
      maxDifference,
      consensusStatus,
    };
  }).sort((a, b) => (b.reviewerCount - a.reviewerCount) || ((b.year || 0) - (a.year || 0)));
}

// ─── Reviewer Statistics ────────────────────────────────────────────────

export function buildReviewerStats(scores, reviewers) {
  // Calculate global average for bias detection
  const allTotals = scores.map(s => getTotal(s));
  const globalAvg = allTotals.length > 0 ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;

  const activeAliases = [...new Set(scores.map(s => s.raterAlias))].filter(Boolean);

  return activeAliases.map(alias => {
    const reviewerScores = scores.filter(s => s.raterAlias === alias);
    const totals = reviewerScores.map(s => getTotal(s));
    const avgScore = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const times = reviewerScores.map(s => s.timeToComplete).filter(t => t != null);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;

    // Scoring patterns: count of 0/1/2 per question
    const patterns = {};
    QUESTION_IDS.forEach(q => {
      const counts = [0, 0, 0];
      reviewerScores.forEach(s => {
        const v = s[q];
        if (v != null && v >= 0 && v <= 2) counts[v]++;
      });
      patterns[q] = counts;
    });

    // Bias indicator
    const biasPct = globalAvg > 0 ? ((avgScore - globalAvg) / globalAvg) * 100 : 0;
    let biasLabel = 'Consistent';
    if (biasPct > 5) biasLabel = `Tends ${Math.round(biasPct)}% higher`;
    else if (biasPct < -5) biasLabel = `Tends ${Math.round(Math.abs(biasPct))}% lower`;

    // Reviewer name from reviewers list
    const reviewer = reviewers.find(r => r.alias === alias);

    return {
      alias,
      name: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : alias,
      articlesReviewed: reviewerScores.length,
      avgScore: Math.round(avgScore * 10) / 10,
      avgTier: getQualityTierLabel(Math.round(avgScore)),
      avgTime: avgTime != null ? Math.round(avgTime * 10) / 10 : null,
      biasLabel,
      biasPct: Math.round(biasPct * 10) / 10,
      patterns,
    };
  }).sort((a, b) => b.articlesReviewed - a.articlesReviewed);
}

// ─── Quality Distributions ──────────────────────────────────────────────

export function buildDistributions(scores) {
  const totals = scores.map(s => getTotal(s));

  // Score histogram (bins of 2)
  const bins = [];
  for (let i = 0; i <= 20; i += 2) {
    const max = Math.min(i + 1, 22);
    const label = i === 22 ? '22' : `${i}-${max}`;
    const count = totals.filter(t => t >= i && t <= max).length;
    bins.push({ range: label, min: i, max, count });
  }

  // Quality tiers
  const high = totals.filter(t => t >= 17).length;
  const moderate = totals.filter(t => t >= 11 && t < 17).length;
  const low = totals.filter(t => t < 11).length;
  const total = totals.length;

  // Per-question breakdown
  const perQuestion = {};
  QUESTION_IDS.forEach(q => {
    const counts = [0, 0, 0];
    scores.forEach(s => {
      const v = s[q];
      if (v != null && v >= 0 && v <= 2) counts[v]++;
    });
    const n = counts.reduce((a, b) => a + b, 0);
    // Mean score for this question (0-2 scale)
    const mean = n > 0 ? (counts[0] * 0 + counts[1] * 1 + counts[2] * 2) / n : 0;

    perQuestion[q] = {
      label: QUESTION_LABELS[q],
      counts,
      percentages: n > 0 ? counts.map(c => Math.round((c / n) * 1000) / 10) : [0, 0, 0],
      mean: Math.round(mean * 100) / 100,
    };
  });

  return {
    scoreHistogram: bins,
    qualityTiers: {
      high, moderate, low, total,
      highPct: total > 0 ? Math.round((high / total) * 1000) / 10 : 0,
      moderatePct: total > 0 ? Math.round((moderate / total) * 1000) / 10 : 0,
      lowPct: total > 0 ? Math.round((low / total) * 1000) / 10 : 0,
    },
    perQuestion,
    totalScores: total,
    avgScore: total > 0 ? Math.round((totals.reduce((a, b) => a + b, 0) / total) * 10) / 10 : 0,
  };
}

// ─── Overall Agreement Percentage ───────────────────────────────────────

export function calculateOverallAgreement(articleScoresMap) {
  let totalComparisons = 0;
  let totalMatches = 0;

  Object.values(articleScoresMap).forEach(scores => {
    if (scores.length < 2) return;
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        QUESTION_IDS.forEach(q => {
          totalComparisons++;
          if (scores[i][q] === scores[j][q]) totalMatches++;
        });
      }
    }
  });

  return totalComparisons > 0
    ? Math.round((totalMatches / totalComparisons) * 1000) / 10
    : 0;
}
