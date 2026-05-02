/**
 * Cochrane RoB 2 Domain Mapping
 *
 * Deterministic translation from the Nordic SQR-RCT 11-item rubric
 * (0/1/2 per item) into Cochrane RoB 2 domain judgments
 * (Low / Some concerns / High) and an overall judgment.
 *
 * Why this exists:
 *   External reviewers, regulators, and plaintiff experts expect the
 *   Cochrane RoB 2 vocabulary. Nordic's in-house 11-item rubric has
 *   stronger published inter-rater reliability than RoB 2 itself
 *   (Minozzi 2020, J Clin Epi 126:37 — RoB 2 overall Fleiss κ = 0.16)
 *   and already maps onto RoB 2's five domains conceptually. This
 *   module is a one-way projection: score once in the SQR rubric,
 *   report in either vocabulary.
 *
 * Rubric → Domain mapping (section 7.1.2 of PCS Gap Analysis):
 *   D1 Randomization           ← Q2 Randomization, Q5 Baseline Characteristics
 *   D2 Deviations              ← Q3 Blinding, Q7 Intervention Description, Q6 Participant Flow
 *   D3 Missing outcome data    ← Q6 Participant Flow, Q9 Statistical Analysis
 *   D4 Measurement of outcome  ← Q3 Blinding, Q8 Outcome Measurement
 *   D5 Selection of reported   ← Q10 Bias Assessment, Q12 Registration check (optional, V3)
 *   Overall                    = worst-domain-wins (standard RoB 2 algorithm)
 *
 * The mapping is deliberately conservative: when rubric signals are
 * ambiguous the domain judgment leans toward "Some concerns" rather
 * than "Low." Rationale is emitted alongside every judgment so the
 * Word export can reproduce the reasoning.
 *
 * References:
 *   Sterne JAC et al. BMJ 2019;366:l4898. DOI: 10.1136/bmj.l4898
 *   Minozzi S et al. J Clin Epidemiol 2020;126:37. DOI: 10.1016/j.jclinepi.2020.06.015
 */

const JUDGMENTS = Object.freeze({
  LOW: 'Low',
  SOME: 'Some concerns',
  HIGH: 'High',
});

// Ordinal severity used for worst-domain-wins aggregation.
const SEVERITY = Object.freeze({
  [JUDGMENTS.LOW]: 0,
  [JUDGMENTS.SOME]: 1,
  [JUDGMENTS.HIGH]: 2,
});

const SEVERITY_TO_JUDGMENT = Object.freeze({
  0: JUDGMENTS.LOW,
  1: JUDGMENTS.SOME,
  2: JUDGMENTS.HIGH,
});

/**
 * Clamp a rubric score to 0/1/2 or null. Unknown/missing values
 * (null, undefined, out-of-range) are treated as null so the caller
 * sees an explicit "No information" rather than a false judgment.
 */
function coerceScore(v) {
  if (v === 0 || v === 1 || v === 2) return v;
  return null;
}

/**
 * Domain 1 — Risk of bias arising from the randomization process.
 *
 * Signals:
 *   Q2 Randomization (allocation method + concealment quality)
 *   Q5 Baseline Characteristics (evidence of imbalance indicating
 *       randomization may have failed)
 *
 * Rules:
 *   Q2 = 0 → High (no/non-random allocation described)
 *   Q2 = null → Some concerns (cannot determine; lean cautious)
 *   Q5 = 0 → at least Some concerns regardless of Q2 (imbalance
 *       suggests randomization failed or was underpowered)
 *   Q2 = 2 AND Q5 ≥ 1 → Low
 *   Q2 = 1 → Some concerns (method stated but concealment or
 *       sequence generation detail missing)
 */
export function domain1(scores) {
  const q2 = coerceScore(scores.q2);
  const q5 = coerceScore(scores.q5);
  const rationale = [];

  if (q2 === 0) {
    return {
      judgment: JUDGMENTS.HIGH,
      rationale: ['Q2 Randomization scored 0: no method described or non-random allocation.'],
    };
  }
  if (q2 === null) {
    return {
      judgment: JUDGMENTS.SOME,
      rationale: ['Q2 Randomization not scored; cannot confirm adequate randomization.'],
    };
  }
  if (q5 === 0) {
    rationale.push('Q5 Baseline Characteristics scored 0: major between-group imbalance or >20% of variables significantly different, suggesting randomization may have failed.');
    return { judgment: JUDGMENTS.SOME, rationale };
  }
  if (q2 === 2) {
    rationale.push('Q2 Randomization scored 2: method identified with evidence of proper implementation including allocation concealment.');
    if (q5 === 2) rationale.push('Q5 Baseline Characteristics scored 2: groups balanced with statistical comparison.');
    return { judgment: JUDGMENTS.LOW, rationale };
  }
  // q2 === 1
  rationale.push('Q2 Randomization scored 1: method stated but sequence generation or allocation concealment detail missing.');
  return { judgment: JUDGMENTS.SOME, rationale };
}

/**
 * Domain 2 — Risk of bias due to deviations from intended interventions.
 *
 * Signals:
 *   Q3 Blinding (participants/providers/assessors)
 *   Q7 Intervention Description (fidelity evidence)
 *   Q6 Participant Flow (attrition balance; proxy for per-protocol vs ITT)
 *
 * Rules:
 *   Q3 = 2 AND Q7 ≥ 1 AND Q6 ≥ 1 → Low
 *   Q3 = 0 → High (no assessor blinding; strong deviation prior)
 *   Q6 = 0 → High (>20% attrition or major imbalance, which is the
 *       canonical RoB 2 "substantial impact" flag on D2 Part 2)
 *   Otherwise → Some concerns
 */
export function domain2(scores) {
  const q3 = coerceScore(scores.q3);
  const q7 = coerceScore(scores.q7);
  const q6 = coerceScore(scores.q6);
  const rationale = [];

  if (q3 === 0) {
    return {
      judgment: JUDGMENTS.HIGH,
      rationale: ['Q3 Blinding scored 0: no blinding of outcome assessors or clear compromise; deviations from assigned intervention likely.'],
    };
  }
  if (q6 === 0) {
    rationale.push('Q6 Participant Flow scored 0: attrition >20% or imbalance >10 percentage points; substantial potential impact on effect estimate.');
    return { judgment: JUDGMENTS.HIGH, rationale };
  }
  if (q3 === 2 && (q7 === 2 || q7 === 1) && (q6 === 2 || q6 === 1)) {
    rationale.push('Q3 Blinding scored 2: double-blind across participants, providers, and assessors.');
    rationale.push(`Q7 Intervention Description scored ${q7}: intervention fidelity adequately documented.`);
    rationale.push(`Q6 Participant Flow scored ${q6}: attrition tracked and within acceptable bounds.`);
    return { judgment: JUDGMENTS.LOW, rationale };
  }
  // Fall-through: single-blind, ambiguous fidelity, or moderate attrition.
  if (q3 !== null) rationale.push(`Q3 Blinding scored ${q3}: blinding adequacy uncertain for at least one trial role.`);
  if (q7 !== null) rationale.push(`Q7 Intervention Description scored ${q7}.`);
  if (q6 !== null) rationale.push(`Q6 Participant Flow scored ${q6}.`);
  if (q3 === null && q7 === null && q6 === null) {
    rationale.push('All D2 signal items (Q3/Q6/Q7) missing.');
  }
  return { judgment: JUDGMENTS.SOME, rationale };
}

/**
 * Domain 3 — Bias due to missing outcome data.
 *
 * Signals:
 *   Q6 Participant Flow (primary: attrition rate + imbalance)
 *   Q9 Statistical Analysis (secondary: missing-data handling)
 *
 * Rules:
 *   Q6 = 2 → Low (attrition <10% and balanced)
 *   Q6 = 0 → High (>20% attrition)
 *   Q6 = 1 OR Q9 = 0 → Some concerns
 *   Q6 missing AND Q9 missing → Some concerns
 */
export function domain3(scores) {
  const q6 = coerceScore(scores.q6);
  const q9 = coerceScore(scores.q9);
  const rationale = [];

  if (q6 === 0) {
    return {
      judgment: JUDGMENTS.HIGH,
      rationale: ['Q6 Participant Flow scored 0: attrition >20% or imbalance >10 percentage points.'],
    };
  }
  if (q6 === 2 && (q9 === 2 || q9 === 1)) {
    rationale.push('Q6 Participant Flow scored 2: <10% attrition, balanced, flow diagram provided.');
    rationale.push(`Q9 Statistical Analysis scored ${q9}: missing data handling described.`);
    return { judgment: JUDGMENTS.LOW, rationale };
  }
  if (q6 === 2 && q9 === 0) {
    rationale.push('Q6 Participant Flow scored 2 but Q9 Statistical Analysis scored 0: missing-data handling not described despite low attrition.');
    return { judgment: JUDGMENTS.SOME, rationale };
  }
  if (q6 === null && q9 === null) {
    return {
      judgment: JUDGMENTS.SOME,
      rationale: ['Neither Q6 nor Q9 scored; cannot confirm acceptable handling of missing outcome data.'],
    };
  }
  // Q6 = 1 or mixed partial information
  if (q6 !== null) rationale.push(`Q6 Participant Flow scored ${q6}: moderate attrition or minor imbalance.`);
  if (q9 !== null) rationale.push(`Q9 Statistical Analysis scored ${q9}.`);
  return { judgment: JUDGMENTS.SOME, rationale };
}

/**
 * Domain 4 — Bias in measurement of the outcome.
 *
 * Signals:
 *   Q8 Outcome Measurement (validated instrument, replicable procedures)
 *   Q3 Blinding (outcome assessor blinding specifically)
 *
 * Rules:
 *   Q8 = 0 → High (no validated instrument; measurement unreliable)
 *   Q3 = 0 → High (no assessor blinding; differential measurement likely)
 *   Q8 = 2 AND Q3 ≥ 1 → Low
 *   Otherwise → Some concerns
 *
 * Note: RoB 2 D4 distinguishes subjective vs objective outcomes, which
 * cannot be inferred from rubric scores alone. This mapping is
 * conservative — subjective outcomes with imperfect blinding should
 * be reviewed manually and may warrant raising Some concerns to High.
 */
export function domain4(scores) {
  const q8 = coerceScore(scores.q8);
  const q3 = coerceScore(scores.q3);
  const rationale = [];

  if (q8 === 0) {
    return {
      judgment: JUDGMENTS.HIGH,
      rationale: ['Q8 Outcome Measurement scored 0: no validated instruments or timing clearly inappropriate.'],
    };
  }
  if (q3 === 0) {
    return {
      judgment: JUDGMENTS.HIGH,
      rationale: ['Q3 Blinding scored 0: no blinding of outcome assessors; differential measurement likely for subjective outcomes.'],
    };
  }
  if (q8 === 2 && (q3 === 2 || q3 === 1)) {
    rationale.push('Q8 Outcome Measurement scored 2: validated instrument with replicable procedures and justified timing.');
    rationale.push(`Q3 Blinding scored ${q3}: outcome assessors blinded or likely blinded.`);
    if (q3 === 1) {
      rationale.push('Caveat: review whether primary outcome is subjective — may warrant raising to Some concerns.');
    }
    return { judgment: JUDGMENTS.LOW, rationale };
  }
  if (q8 === null && q3 === null) {
    return {
      judgment: JUDGMENTS.SOME,
      rationale: ['Both Q8 Outcome Measurement and Q3 Blinding missing; cannot confirm outcome measurement integrity.'],
    };
  }
  if (q8 !== null) rationale.push(`Q8 Outcome Measurement scored ${q8}: validation or procedure detail partial.`);
  if (q3 !== null) rationale.push(`Q3 Blinding scored ${q3}: assessor blinding not fully confirmed.`);
  return { judgment: JUDGMENTS.SOME, rationale };
}

/**
 * Domain 5 — Bias in selection of the reported result.
 *
 * Signals:
 *   Q10 Bias Assessment (explicit discussion of bias types)
 *   Q12 Trial Registration (V3 rubric only — optional YES/NO check
 *       against ClinicalTrials.gov / ISRCTN / CTRI)
 *
 * Rules:
 *   Q10 = 0 → High (no formal bias discussion)
 *   Q10 = 2 AND registration = true → Low
 *   Q10 = 2 AND registration = false → Some concerns (bias discussed
 *       but no pre-specified plan anchor)
 *   Q10 = 2 AND registration undefined (V1/V2) → Low with caveat
 *   Q10 = 1 → Some concerns regardless of registration
 *   Q10 = null → Some concerns
 */
export function domain5(scores) {
  const q10 = coerceScore(scores.q10);
  const registered = scores.q12 === true || scores.q12 === 'Y' || scores.q12 === 'Yes' || scores.registrationFound === true;
  const registrationUnknown = scores.q12 === undefined && scores.registrationFound === undefined;
  const rationale = [];

  if (q10 === 0) {
    return {
      judgment: JUDGMENTS.HIGH,
      rationale: ['Q10 Bias Assessment scored 0: generic limitations only or fewer than two bias types acknowledged.'],
    };
  }
  if (q10 === null) {
    return {
      judgment: JUDGMENTS.SOME,
      rationale: ['Q10 Bias Assessment not scored; cannot confirm structured consideration of selective reporting.'],
    };
  }
  if (q10 === 2) {
    if (registered) {
      rationale.push('Q10 Bias Assessment scored 2: ≥4 bias types discussed with mitigation strategies.');
      rationale.push('Trial registration confirmed: pre-specified analysis plan anchors reported results.');
      return { judgment: JUDGMENTS.LOW, rationale };
    }
    if (registrationUnknown) {
      rationale.push('Q10 Bias Assessment scored 2: ≥4 bias types discussed.');
      rationale.push('Caveat: trial registration check not performed (rubric V1/V2 — upgrade to V3 adds Q12).');
      return { judgment: JUDGMENTS.LOW, rationale };
    }
    // registered === false
    rationale.push('Q10 Bias Assessment scored 2 but trial registration not found; selective reporting cannot be excluded.');
    return { judgment: JUDGMENTS.SOME, rationale };
  }
  // q10 === 1
  rationale.push('Q10 Bias Assessment scored 1: only 2-3 bias types acknowledged in limitations.');
  if (registered === false && !registrationUnknown) rationale.push('Trial registration not found.');
  return { judgment: JUDGMENTS.SOME, rationale };
}

/**
 * Overall judgment — worst-domain-wins (standard RoB 2 algorithm).
 *
 * RoB 2 Full Guidance §4.2: "The overall risk-of-bias judgement for
 * a specific outcome being assessed is derived from the judgements
 * across each domain — the worst of these judgements determines the
 * overall judgement."
 */
export function overallJudgment(domains) {
  let maxSeverity = 0;
  for (const d of domains) {
    const s = SEVERITY[d.judgment];
    if (s === undefined) continue;
    if (s > maxSeverity) maxSeverity = s;
  }
  return SEVERITY_TO_JUDGMENT[maxSeverity];
}

/**
 * Map a full 11-item (or 12-item V3) rubric score record to the
 * complete RoB 2 output: 5 per-domain judgments + overall judgment,
 * each with rationale.
 *
 * @param {Object} scores - rubric answers keyed q1..q11 (0/1/2/null),
 *                          optional q12 (true/false/undefined) for V3
 * @returns {Object} { d1, d2, d3, d4, d5, overall, rationale }
 */
export function mapRubricToRoB2(scores) {
  const d1 = domain1(scores);
  const d2 = domain2(scores);
  const d3 = domain3(scores);
  const d4 = domain4(scores);
  const d5 = domain5(scores);
  const overall = overallJudgment([d1, d2, d3, d4, d5]);

  return {
    d1: { name: 'Randomization process', ...d1 },
    d2: { name: 'Deviations from intended interventions', ...d2 },
    d3: { name: 'Missing outcome data', ...d3 },
    d4: { name: 'Measurement of the outcome', ...d4 },
    d5: { name: 'Selection of the reported result', ...d5 },
    overall,
    algorithm: 'worst-domain-wins (RoB 2 Full Guidance §4.2)',
    rubricContract: 'Nordic SQR-RCT 11-item rubric (V1/V2/V3) → RoB 2 projection',
  };
}

export { JUDGMENTS };
