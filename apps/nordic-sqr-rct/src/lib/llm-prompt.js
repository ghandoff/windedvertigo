/**
 * LLM Prompt Builder for SQR-RCT Auto-Scoring
 * Constructs a structured prompt from the rubric and intake data,
 * and validates LLM responses against valid notionValue strings.
 * Supports rubric versioning (V1/V2).
 */

import { RUBRIC_QUESTIONS, getRubricByVersion, getValidValues, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';

const SYSTEM_PROMPT = `You are an expert research methodology reviewer specializing in evaluating the quality of Randomized Controlled Trials (RCTs). You will be given detailed metadata about a published RCT study and must score it on 11 quality dimensions using a standardized rubric.

For each question, you MUST select EXACTLY one of the provided scoring options by returning the EXACT "notionValue" string. Do not paraphrase, shorten, or modify these strings in any way.

Respond with a valid JSON object containing:
- "q1" through "q11": the exact notionValue string for your selected score
- "reasoning": a brief (2-3 sentence) overall summary of the study's quality

Be objective and evidence-based. Only score based on what is explicitly stated in the study data provided. If information is missing or unclear, score conservatively (lower).`;

/**
 * Build the user prompt containing rubric + article data.
 * @param {Object} intakeData - Study intake data from Notion
 * @param {string} [version] - Rubric version ('V1' or 'V2', defaults to DEFAULT_RUBRIC_VERSION)
 */
export function buildScoringPrompt(intakeData, version = DEFAULT_RUBRIC_VERSION) {
  const rubric = getRubricByVersion(version);
  let prompt = `## SCORING RUBRIC (${version})\n\n`;

  for (const q of rubric) {
    prompt += `### ${q.id.toUpperCase()}: ${q.label}\n`;
    prompt += `${q.description}\n\n`;
    prompt += 'Choose ONE of these exact options:\n';
    for (const opt of q.options) {
      prompt += `- notionValue: "${opt.notionValue}"\n`;
      prompt += `  Criteria: ${opt.criteria.join('; ')}\n`;
    }
    prompt += '\n';
  }

  prompt += '---\n\n## ARTICLE DATA\n\n';
  prompt += formatIntakeData(intakeData);
  prompt += '\n---\n\n';
  prompt += 'Now score this article. Return ONLY a JSON object with keys q1-q11 (each an exact notionValue string from above) and "reasoning" (a brief summary).';

  return { systemPrompt: SYSTEM_PROMPT, userPrompt: prompt };
}

function formatIntakeData(data) {
  const fields = [
    ['Citation', data.citation],
    ['DOI', data.doi],
    ['Year', data.year],
    ['Journal', data.journal],
    ['Purpose of Research', data.purposeOfResearch],
    ['Study Design', data.studyDesign],
    ['Blinding', data.blinding],
    ['A Priori Power Estimation', data.aPrioriPower],
    ['Funding Sources', data.fundingSources],
    ['Inclusion Criteria', data.inclusionCriteria],
    ['Exclusion Criteria', data.exclusionCriteria],
    ['Recruitment', data.recruitment],
    ['Initial N', data.initialN],
    ['Final N', data.finalN],
    ['Ages (group means)', data.ages],
    ['Female Participants', data.femaleParticipants],
    ['Male Participants', data.maleParticipants],
    ['Location (Country)', data.locationCountry],
    ['Location (City)', data.locationCity],
    ['Timing of Measures', data.timingOfMeasures],
    ['Independent Variables', data.independentVariables],
    ['Dependent Variables', data.dependentVariables],
    ['Control Variables', data.controlVariables],
    ['Key Results', data.keyResults],
    ['Other Results', data.otherResults],
    ['Statistical Methods', data.statisticalMethods],
    ['Missing Data Handling', data.missingDataHandling],
    ['Authors\' Conclusion', data.authorsConclusion],
    ['Strengths', data.strengths],
    ['Limitations', data.limitations],
    ['Potential Biases', data.potentialBiases],
  ];

  return fields
    .filter(([, val]) => val != null && val !== '')
    .map(([label, val]) => `**${label}:** ${val}`)
    .join('\n');
}

/**
 * Validate that LLM response contains valid notionValue strings for all q1-q11.
 * @param {Object} response - LLM response object with q1-q11 keys
 * @param {string} [version] - Rubric version to validate against
 * Returns { valid: true, scores: { q1, ..., q11 }, reasoning } or { valid: false, errors: [...] }
 */
export function validateLLMScores(response, version = DEFAULT_RUBRIC_VERSION) {
  const rubric = getRubricByVersion(version);
  const validValues = getValidValues(version);
  const errors = [];
  const scores = {};

  for (const q of rubric) {
    const val = response[q.id];
    if (!val) {
      errors.push(`Missing ${q.id}`);
      continue;
    }
    if (validValues[q.id].includes(val)) {
      scores[q.id] = val;
    } else {
      // Try fuzzy match — find closest valid value by prefix
      const match = validValues[q.id].find(v =>
        v.startsWith(val.substring(0, 5)) || val.startsWith(v.substring(0, 5))
      );
      if (match) {
        scores[q.id] = match;
      } else {
        errors.push(`Invalid ${q.id}: "${val.substring(0, 60)}..."`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    scores,
    reasoning: response.reasoning || '',
  };
}

export { SYSTEM_PROMPT };
