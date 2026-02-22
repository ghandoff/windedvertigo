// ─── SQR-RCT Rubric Definitions ─────────────────────────────────────────────
// V1: Original rubric (frozen — matches production Notion select values)
// V2: Data-driven revision from validation study (Section 3.2.6)
// ─────────────────────────────────────────────────────────────────────────────

export const RUBRIC_VERSIONS = ['V1', 'V2'];
export const DEFAULT_RUBRIC_VERSION = 'V2';

// ═══════════════════════════════════════════════════════════════════════════════
// V1 — Original Rubric (frozen)
// ═══════════════════════════════════════════════════════════════════════════════

export const RUBRIC_QUESTIONS_V1 = [
  {
    id: 'q1', number: 1, label: 'Research Question', property: 'Q1 Research Question',
    description: 'Is the research question clearly formulated with population, intervention, comparator, and outcomes?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 - High: Method of randomization identified; Clear evidence of proper implementation of randomization',
        criteria: ['Clearly formulated question addressing population, intervention, comparator, and outcomes (PICO)', 'Well-defined primary and secondary objectives'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 - Moderate: Partially formulated question with some elements missing',
        criteria: ['Partially formulated question with some PICO elements missing', 'Objectives stated but lacking specificity'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 - Low: Poorly formulated or missing research question',
        criteria: ['Poorly formulated or missing research question', 'No clear study objectives identified'] },
    ],
  },
  {
    id: 'q2', number: 2, label: 'Randomization', property: 'Q2 Randomization',
    description: 'Was the method of randomization adequately described and properly implemented?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Method of randomization identified; Clear evidence of proper implementation of randomization',
        criteria: ['Method of randomization identified', 'Clear evidence of proper implementation of randomization'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Basic description of randomization method provided; Some evidence of randomization implementation but lacks detail',
        criteria: ['Basic description of randomization method provided', 'Some evidence of randomization implementation, but lacks detail'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: No description of randomization method; Non-random allocation of participants; Clear evidence of compromised randomization process',
        criteria: ['No description of randomization method', 'Non-random allocation of participants', 'Clear evidence of compromised randomization process'] },
    ],
  },
  {
    id: 'q3', number: 3, label: 'Blinding', property: 'Q3 Blinding',
    description: 'Was the blinding of participants, providers, and outcome assessors adequate?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Double-blind design with effective blinding of both participants and providers',
        criteria: ['Double-blind design with effective blinding of both participants and providers'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Single-blind design or partial blinding of participants or providers; Blinding attempted but potentially compromised in some cases',
        criteria: ['Single-blind design or partial blinding of participants or providers', 'Blinding attempted but potentially compromised in some cases'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: No blinding of outcome assessors; Clear evidence that assessor blinding was compromised',
        criteria: ['No blinding of outcome assessors', 'Clear evidence that assessor blinding was compromised'] },
    ],
  },
  {
    id: 'q4', number: 4, label: 'Sample Size', property: 'Q4 Sample Size',
    description: 'Was an a priori power calculation performed and was the sample size adequate?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: A priori power calculation performed and reported; Sample size meets or exceeds calculated requirement',
        criteria: ['A priori power calculation performed and reported', 'Sample size meets or exceeds calculated requirement'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Power calculation performed but lacking some details; Sample size close to but slightly below calculated requirement',
        criteria: ['Power calculation performed but lacking some details', 'Sample size close to but slightly below calculated requirement'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: No power calculation reported; Sample size clearly inadequate for study objectives',
        criteria: ['No power calculation reported', 'Sample size clearly inadequate for study objectives'] },
    ],
  },
  {
    id: 'q5', number: 5, label: 'Baseline Characteristics', property: 'Q5 Baseline Characteristics',
    description: 'Were baseline characteristics clearly described and groups comparable?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Clear description of inclusion/exclusion criteria baseline characteristics groups similar',
        criteria: ['Clear description of inclusion/exclusion criteria', 'Baseline characteristics compared between groups and found similar'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Partial description of characteristics or minor differences between groups',
        criteria: ['Partial description of characteristics', 'Minor differences between groups'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: Unclear baseline characteristics or major differences between groups',
        criteria: ['Unclear baseline characteristics', 'Major differences between groups'] },
    ],
  },
  {
    id: 'q6', number: 6, label: 'Participant Flow', property: 'Q6 Participant Flow',
    description: 'Was participant flow (attrition, dropouts) adequately described?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Low attrition (<10%) with balanced loss across groups; Detailed flow diagram of participant progress; Comprehensive analysis of attrition and its potential impact',
        criteria: ['Low attrition (<10%) with balanced loss across groups', 'Detailed flow diagram of participant progress through the study', 'Comprehensive analysis of reasons for attrition and its potential impact'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Moderate attrition (10-20%) or slight imbalance between groups; Basic info on participant flow provided; Some analysis of attrition reasons but lacking depth',
        criteria: ['Moderate attrition (10-20%) or slight imbalance between groups', 'Basic info on participant flow provided', 'Some analysis of attrition reasons, but lacking depth'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: High attrition (>20%) or significant imbalance between groups; Inadequate or no information on participant flow; No analysis of attrition or its potential impact',
        criteria: ['High attrition (>20%) or significant imbalance between groups', 'Inadequate or no information on participant flow', 'No analysis of reasons for attrition or its potential impact'] },
    ],
  },
  {
    id: 'q7', number: 7, label: 'Intervention Description', property: 'Q7 Intervention Description',
    description: 'Were the experimental and control interventions adequately described?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Detailed description of experimental and control interventions', criteria: ['Detailed description of experimental and control interventions'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Partial description of interventions', criteria: ['Partial description of interventions'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: Unclear or missing description of interventions', criteria: ['Unclear or missing description of interventions'] },
    ],
  },
  {
    id: 'q8', number: 8, label: 'Outcome Measurement', property: 'Q8 Outcome Measurement',
    description: 'Were validated, reliable outcome measures used with appropriate timing?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Used validated reliable outcome measures for all key variables; Detailed outcome assessment procedures; Appropriate timing & frequency of outcome assessments',
        criteria: ['Use of validated, reliable outcome measures for all key variables', 'Detailed description of outcome measurement procedures', 'Appropriate timing and frequency of outcome assessments'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Mix of validated and non-validated outcome measures; Basic description of outcome measurement procedures; Some inconsistencies in timing or frequency of assessments',
        criteria: ['Mix of validated and non-validated outcome measures', 'Basic description of outcome measurement procedures', 'Some inconsistencies in timing or frequency of assessments'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: Primarily non-validated or unreliable outcome measures; Inadequate description of measurement procedures; Inappropriate or inconsistent timing of outcome assessments',
        criteria: ['Primarily non-validated or unreliable outcome measures', 'Inadequate description of measurement procedures', 'Inappropriate or inconsistent timing of outcome assessments'] },
    ],
  },
  {
    id: 'q9', number: 9, label: 'Statistical Analysis', property: 'Q9 Statistical Analysis',
    description: 'Was the statistical analysis plan comprehensive and appropriate?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Comprehensive statistical analysis plan aligned with study objectives; Appropriate use of advanced statistical methods; Reporting of effect sizes and confidence intervals',
        criteria: ['Comprehensive statistical analysis plan aligned with study objectives', 'Appropriate use of advanced statistical methods', 'Thorough reporting of effect sizes and confidence intervals'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Basic statistical analysis plan and methods; Some advanced statistical techniques used not comprehensively; Reporting of main statistical outcomes but lacking detail',
        criteria: ['Basic statistical analysis plan with standard methods', 'Some advanced statistical techniques used, but not comprehensively', 'Reporting of main statistical outcomes, but lacking some detail'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: Inadequate or inappropriate statistical analysis methods; Failure to account for study design in analysis (e.g. clustering in multi-site trials); Incomplete or unclear',
        criteria: ['Inadequate or inappropriate statistical analysis methods', 'Failure to account for study design in analysis', 'Incomplete or unclear reporting of statistical results'] },
    ],
  },
  {
    id: 'q10', number: 10, label: 'Bias Assessment', property: 'Q10 Bias Assessment',
    description: 'Was the risk of bias comprehensively assessed and mitigated?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: Comprehensive risk of bias assessment using validated tools; Thorough assessment and mitigation of potential biases',
        criteria: ['Comprehensive risk of bias assessment using validated tools', 'Thorough assessment and mitigation of potential biases'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Basic risk of bias assessment conducted using standard criteria; Basic description of randomization technique (e.g. coin toss)',
        criteria: ['Basic risk of bias assessment conducted using standard criteria', 'Basic description of randomization technique (e.g., coin toss)'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: Inadequate or no formal risk of bias assessment',
        criteria: ['Inadequate or no formal risk of bias assessment'] },
    ],
  },
  {
    id: 'q11', number: 11, label: 'Applicability', property: 'Q11 Applicability',
    description: 'Does the study have strong external validity and clear clinical significance?',
    options: [
      { score: 2, tier: 'High', label: '2 — High', notionValue: '2 — High: High external validity and clear clinical significance; Detailed consideration of how intervention would translate to real-world settings',
        criteria: ['High external validity and clear clinical significance', 'Detailed consideration of how intervention would translate to real-world settings'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate', notionValue: '1 — Moderate: Moderate external validity or clinical significance; Limited analysis of context-dependent factors affecting effectiveness',
        criteria: ['Moderate external validity or clinical significance', 'Limited analysis of context-dependent factors affecting effectiveness'] },
      { score: 0, tier: 'Low', label: '0 — Low', notionValue: '0 — Low: Low external validity or unclear clinical significance; No explicit consideration of applicability to target population',
        criteria: ['Low external validity or unclear clinical significance', 'No explicit consideration of applicability to target population'] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 — Data-Driven Revision (Validation Study Section 3.2.6)
// Tier 5: Retain with Minor Enhancement (Q3)
// Tier 4: Adjust for Field Realities (Q4, Q10)
// Tier 3: Sharpen Boundaries (Q2, Q6, Q9)
// Tier 2: Raise the Bar (Q1, Q7)
// Tier 1: Full Rewrite (Q5, Q8, Q11)
// ═══════════════════════════════════════════════════════════════════════════════

export const RUBRIC_QUESTIONS_V2 = [
  {
    id: 'q1', number: 1, label: 'Research Question', property: 'Q1 Research Question',
    description: 'Is the research question clearly formulated with population, intervention, comparator, and outcomes (PICO)?',
    tier: 2, tierLabel: 'Raise the Bar',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: All four PICO elements explicitly stated with primary outcome identified AND clinical significance articulated',
        criteria: ['All four PICO elements explicitly stated with primary outcome identified', 'Clinical significance articulated'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: All four PICO elements present but primary outcome not distinguished from secondary; OR three PICO elements clearly stated',
        criteria: ['All four PICO elements present but primary outcome not distinguished from secondary', 'OR three PICO elements clearly stated'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: Fewer than three PICO elements stated',
        criteria: ['Fewer than three PICO elements stated'] },
    ],
  },
  {
    id: 'q2', number: 2, label: 'Randomization', property: 'Q2 Randomization',
    description: 'Was the method of randomization adequately described and properly implemented, including allocation concealment?',
    tier: 3, tierLabel: 'Sharpen Boundaries',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Method of randomization identified (computer-generated, random number table, or equivalent); Clear evidence of proper implementation including allocation concealment',
        criteria: ['Method of randomization identified (computer-generated, random number table, or equivalent)', 'Clear evidence of proper implementation including allocation concealment'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Basic randomization method stated without specifying sequence generation; OR randomization method clear but allocation concealment not described',
        criteria: ['Basic randomization method stated ("participants were randomized") without specifying sequence generation', 'OR randomization method clear but allocation concealment not described', 'OR stratified/block randomization mentioned without implementation details'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: No description of randomization method; Non-random allocation of participants',
        criteria: ['No description of randomization method', 'Non-random allocation of participants'] },
    ],
  },
  {
    id: 'q3', number: 3, label: 'Blinding', property: 'Q3 Blinding',
    description: 'Was the blinding of participants, providers, and outcome assessors adequate?',
    tier: 5, tierLabel: 'Retain with Minor Enhancement',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Double-blind design with effective blinding of participants, providers, AND outcome assessors; Explicit statement that blinding was maintained',
        criteria: ['Double-blind design with effective blinding of participants, intervention providers, AND outcome assessors', 'Explicit statement that blinding was maintained'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Single-blind design (any ONE of: participants, providers, or assessors blinded); OR double-blind with possible compromise',
        criteria: ['Single-blind design (any ONE of: participants, providers, or assessors blinded)', 'OR double-blind design with possible compromise', 'OR blinding status unclear but likely present'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: No blinding of outcome assessors; Clear evidence that assessor blinding was compromised',
        criteria: ['No blinding of outcome assessors', 'Clear evidence that assessor blinding was compromised'] },
    ],
  },
  {
    id: 'q4', number: 4, label: 'Sample Size', property: 'Q4 Sample Size',
    description: 'Was an a priori power calculation performed and was the sample size adequate?',
    tier: 4, tierLabel: 'Adjust for Field Realities',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: A priori power calculation with key parameters reported (effect size, alpha, power); Achieved sample meets target',
        criteria: ['A priori power calculation with key parameters reported (effect size, alpha, power)', 'Achieved sample meets target'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Power calculation mentioned but incomplete details; Achieved sample within 10% of target; OR justified by precedent',
        criteria: ['Power calculation mentioned but incomplete details', 'Achieved sample within 10% of target', 'OR justified by precedent'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: No power calculation and no sample size justification',
        criteria: ['No power calculation and no sample size justification'] },
    ],
  },
  {
    id: 'q5', number: 5, label: 'Baseline Characteristics', property: 'Q5 Baseline Characteristics',
    description: 'Were baseline characteristics clearly described with inclusion/exclusion criteria, tabulated comparison, and group equivalence?',
    tier: 1, tierLabel: 'Full Rewrite',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Inclusion/exclusion criteria stated; Baseline table with ≥5 variables; Groups statistically compared; No clinically important imbalances',
        criteria: ['Inclusion/exclusion criteria stated', 'Baseline table with \u22655 variables', 'Groups statistically compared', 'No clinically important imbalances'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Three of four High elements present; 10-20% of variables significantly different; Minor imbalance acknowledged',
        criteria: ['Three of four High elements present', '10-20% of variables significantly different', 'Minor imbalance acknowledged but not addressed'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: Fewer than three elements; >20% of variables significantly different; Major imbalance not addressed',
        criteria: ['Fewer than three elements', '>20% of variables significantly different', 'Major imbalance not addressed'] },
    ],
  },
  {
    id: 'q6', number: 6, label: 'Participant Flow', property: 'Q6 Participant Flow',
    description: 'Was participant flow (attrition, dropouts) adequately described with quantified thresholds?',
    tier: 3, tierLabel: 'Sharpen Boundaries',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Attrition <10% and balanced between groups (<5pp difference); Flow diagram provided; Reasons and impact discussed',
        criteria: ['Attrition <10% and balanced between groups (<5 percentage point difference)', 'Flow diagram provided', 'Reasons and impact discussed'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Attrition 10-20% OR imbalance 5-10 percentage points; Basic accounting provided',
        criteria: ['Attrition 10-20% OR imbalance 5-10 percentage points', 'Basic accounting provided'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: Attrition >20% OR imbalance >10 percentage points; No flow accounting',
        criteria: ['Attrition >20% OR imbalance >10 percentage points', 'No flow accounting'] },
    ],
  },
  {
    id: 'q7', number: 7, label: 'Intervention Description', property: 'Q7 Intervention Description',
    description: 'Were the experimental and control interventions adequately described across five key components?',
    tier: 2, tierLabel: 'Raise the Bar',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: All 5 components specified: dose/intensity, frequency, duration, delivery method, and control composition/protocol',
        criteria: ['Dose/intensity specified', 'Frequency specified', 'Duration specified', 'Delivery method specified', 'Control composition or protocol specified'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: 3-4 of the 5 intervention components specified',
        criteria: ['3\u20134 of the 5 components specified'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: 2 or fewer intervention components specified',
        criteria: ['\u22642 components specified'] },
    ],
  },
  {
    id: 'q8', number: 8, label: 'Outcome Measurement', property: 'Q8 Outcome Measurement',
    description: 'Were validated, reliable outcome measures used with replicable procedures and justified timing?',
    tier: 1, tierLabel: 'Full Rewrite',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Primary outcome uses validated instrument with citation; Measurement procedures replicate-ready; Assessment timing pre-specified and biologically justified',
        criteria: ['Primary outcome uses validated instrument with citation', 'Measurement procedures replicate-ready', 'Assessment timing pre-specified and biologically justified'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Primary outcome validation unclear but standard in field; Procedures described but not replicable; Timing appropriate but not pre-specified',
        criteria: ['Primary outcome validation unclear but standard in field', 'Measurement procedures described but not replicable', 'Timing appropriate but not pre-specified'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: No validation evidence cited; Timing clearly inappropriate for intervention mechanism',
        criteria: ['No validation evidence cited', 'Timing clearly inappropriate for intervention mechanism'] },
    ],
  },
  {
    id: 'q9', number: 9, label: 'Statistical Analysis', property: 'Q9 Statistical Analysis',
    description: 'Was the statistical analysis plan comprehensive with effect sizes, confidence intervals, and appropriate methods?',
    tier: 3, tierLabel: 'Sharpen Boundaries',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Effect sizes AND confidence intervals reported for primary outcomes; Missing data handling described; Multiple comparison adjustment when needed',
        criteria: ['Effect sizes AND confidence intervals reported for primary outcomes', 'Missing data handling described', 'Multiple comparison adjustment when needed'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Effect sizes OR confidence intervals reported (not both); Missing data handling not described',
        criteria: ['Effect sizes OR confidence intervals reported (not both)', 'Missing data handling not described'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: Neither effect sizes nor confidence intervals reported; Inappropriate methods for study design',
        criteria: ['Neither effect sizes nor confidence intervals reported', 'Inappropriate methods for study design'] },
    ],
  },
  {
    id: 'q10', number: 10, label: 'Bias Assessment', property: 'Q10 Bias Assessment',
    description: 'Did the authors assess and discuss specific types of bias using a structured framework?',
    tier: 4, tierLabel: 'Adjust for Field Realities',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Authors discuss ≥4 specific bias types using structured framework; Mitigation strategies described',
        criteria: ['Authors discuss \u22654 specific bias types (e.g., selection, performance, detection, attrition, reporting) using structured framework', 'Mitigation strategies described'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Authors acknowledge 2-3 specific bias types in limitations section',
        criteria: ['Authors acknowledge 2-3 specific bias types in limitations section'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: Generic limitations only without connecting to specific bias types; Fewer than two bias types acknowledged',
        criteria: ['Generic limitations only ("our study has limitations") without connecting to specific bias types', 'Fewer than two bias types acknowledged'] },
    ],
  },
  {
    id: 'q11', number: 11, label: 'Applicability', property: 'Q11 Applicability',
    description: 'Does the study address external validity across population representativeness, intervention feasibility, and outcome relevance?',
    tier: 1, tierLabel: 'Full Rewrite',
    options: [
      { score: 2, tier: 'High', label: '2 — High',
        notionValue: '2 — High [V2]: Population representativeness discussed with specific comparison to target; Intervention feasibility in routine practice assessed; Outcome relevance to clinical decision-making stated',
        criteria: ['Population representativeness discussed with specific comparison to target population', 'Intervention feasibility in routine practice assessed', 'Outcome relevance to clinical decision-making stated'] },
      { score: 1, tier: 'Moderate', label: '1 — Moderate',
        notionValue: '1 — Moderate [V2]: Two of three applicability domains addressed; OR explanatory trial with authors acknowledging applicability trade-offs',
        criteria: ['Two of three domains addressed', 'OR explanatory trial with authors acknowledging applicability trade-offs'] },
      { score: 0, tier: 'Low', label: '0 — Low',
        notionValue: '0 — Low [V2]: Fewer than two applicability domains addressed; Severely limited applicability without author acknowledgment',
        criteria: ['Fewer than two domains addressed', 'Severely limited applicability without author acknowledgment'] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get rubric questions array by version string.
 * @param {string} version - 'V1' or 'V2' (defaults to DEFAULT_RUBRIC_VERSION)
 */
export function getRubricByVersion(version) {
  if (version === 'V1') return RUBRIC_QUESTIONS_V1;
  return RUBRIC_QUESTIONS_V2;
}

/**
 * Get all valid notionValues for a given version (for LLM validation).
 * @param {string} version - 'V1' or 'V2'
 * @returns {Object} Map of question id -> array of valid notionValue strings
 */
export function getValidValues(version) {
  const rubric = getRubricByVersion(version);
  const valid = {};
  for (const q of rubric) {
    valid[q.id] = q.options.map(o => o.notionValue);
  }
  return valid;
}

/**
 * Detect which rubric version a notionValue string belongs to.
 * V2 notionValues contain "[V2]" marker.
 * @param {string} notionValue - A notionValue string from a score
 * @returns {string} 'V1' or 'V2'
 */
export function detectVersionFromNotionValue(notionValue) {
  if (notionValue && notionValue.includes('[V2]')) return 'V2';
  return 'V1';
}

// Default export — V2 is the active rubric for new scores
export const RUBRIC_QUESTIONS = RUBRIC_QUESTIONS_V2;

export const QUALITY_TIERS = [
  { label: 'High Quality', range: [17, 22], color: 'green' },
  { label: 'Moderate Quality', range: [11, 16], color: 'yellow' },
  { label: 'Low Quality', range: [0, 10], color: 'red' },
];

export function getQualityTier(totalScore) {
  if (totalScore >= 17) return QUALITY_TIERS[0];
  if (totalScore >= 11) return QUALITY_TIERS[1];
  return QUALITY_TIERS[2];
}

export const BLINDING_OPTIONS = ['None', 'Single', 'Double', 'Triple', 'Assessor only'];

export const A_PRIORI_POWER_OPTIONS = [
  'A priori sample size was calculated and the achieved sample size met this target',
  'A priori sample size was calculated but the achieved sample did not meet this target',
  'A priori sample size calculation was NOT reported',
  'A priori sample size calculation was not reported and it was either not necessary (for example for an early or exploratory RCT) or it is unclear whether such a calculation was required',
];
