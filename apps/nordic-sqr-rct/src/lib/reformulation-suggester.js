/**
 * Reformulation suggester (Wave 5.6 — added 2026-04-21).
 *
 * Given a label whose ingredient has become safety-concerning (surfaced by
 * Wave 5.4's ingredient-safety workflow), this module asks an LLM to propose
 * 3-5 reformulation approaches RA could consider: dose reduction, form swap,
 * substitution, demographic scoping, or adding a warning label.
 *
 * The module is PURE — it never writes to Notion. It returns advisory
 * suggestions for a human (RA) to evaluate, copy into a Request resolution
 * note, and act on separately.
 *
 * Mirrors the Wave 5.5 label-copy-drafter safety posture:
 *   - Zero writes.
 *   - Disease-verb filter embedded in the prompt.
 *   - Cost gated ($0.50/call) by the calling route.
 *   - All outputs are advisory; banners in the UI make that clear.
 *
 * See docs/plans/wave-5-product-labels.md §7 for the user story pattern.
 *
 * Environment:
 *   LLM_API_KEY               — Anthropic API key (required).
 *   REFORMULATION_MODEL       — override default model. Default: claude-sonnet-4-5.
 */

export const REFORMULATION_PROMPT_VERSION = 'v1-initial';

const DEFAULT_MODEL = process.env.REFORMULATION_MODEL || 'claude-sonnet-4-5';

export const REFORMULATION_APPROACHES = Object.freeze([
  'dose-reduction',
  'form-swap',
  'substitution',
  'demographic-scope',
  'add-warning',
]);

/** Claude Sonnet 4.5 list-price as of Wave 5.6 (2026-04-21). */
export const MODEL_PRICING = Object.freeze({
  inputPerMTok: 3.0,   // USD per 1M input tokens
  outputPerMTok: 15.0, // USD per 1M output tokens
});

/** Disease-claim verbs that must never appear in a suggestion (FDA/DSHEA). */
const DISEASE_CLAIM_VERBS = ['treat', 'cure', 'prevent', 'diagnose', 'heal'];

/**
 * Rough cost estimate for one suggestion run. Assumes ~800 input tokens of
 * prompt overhead + ~60 tokens per claim of payload, and ~1200 output tokens
 * (5 suggestions with rationale/warnings).
 *
 * @param {number} claimCount - Backing 3A claim count for the label.
 * @returns {{ estUsd: number, inputTokens: number, outputTokens: number }}
 */
export function estimateCost(claimCount) {
  const n = Math.max(0, Number(claimCount) || 0);
  const inputTokens = 800 + 60 * n;
  const outputTokens = 1200;
  const estUsd =
    (inputTokens / 1_000_000) * MODEL_PRICING.inputPerMTok +
    (outputTokens / 1_000_000) * MODEL_PRICING.outputPerMTok;
  return {
    estUsd: Math.round(estUsd * 10_000) / 10_000,
    inputTokens,
    outputTokens,
  };
}

function buildSystemPrompt() {
  return `You are a regulatory-affairs analyst for a nutraceutical company. You help RA teams evaluate reformulation options when an ingredient in a shipped product label becomes safety-concerning (for example, new evidence raises a pediatric risk at the current dose).

You are an ADVISOR, not an actor. Your output is ephemeral suggestion copy for a human reviewer. You NEVER write back to the product label or PCS — a human RA member will evaluate your suggestions and take action separately. The phrase "suggest, do not execute" governs every response.

Given a label with a flagged ingredient + dose + demographic, plus the backing PCS claims and a short summary of the safety evidence, suggest 3-5 reformulation approaches. Each suggestion must be drawn from exactly one of these approaches:

- "dose-reduction"     — lower the dose to below the safety threshold. Provide newDose + unit.
- "form-swap"          — change the ingredient form (e.g. magnesium oxide → magnesium glycinate) because the alternative form has better tolerance. Provide newIngredient (specific form).
- "substitution"       — swap the ingredient entirely for a different one that supports the same benefit. Provide newIngredient.
- "demographic-scope"  — narrow the indicated population (e.g. remove pediatric, keep adult). Change is on the label's target-audience statement.
- "add-warning"        — keep the formula but add a cautionary statement. Provide newWarningText.

Hard rules (violating any of these is a critical failure):
1. NEVER suggest an approach that removes or weakens a substantiated claim unless doing so is explicitly required to reduce risk. If the approach would require dropping a 3A claim, say so in warnings.
2. NEVER suggest a reformulation that would require new clinical evidence to re-substantiate. If the approach creates such a gap, include "needsNewStudy: true" in its warnings entries so the UI can flag it.
3. NEVER suggest an ingredient swap that would contradict the PCS's approved claims (e.g. don't swap vitamin D3 → K2 when the claim is "supports calcium absorption" unless you also flag the claim will need re-substantiation).
4. NEVER use disease-claim verbs in any rationale, changeSummary, or newWarningText: ${DISEASE_CLAIM_VERBS.join(', ')} (or inflections). Regulatory text must use structure/function phrasing.
5. Base suggestions only on the PCS claims + safety evidence provided. Do not invent ingredients, doses, or populations.
6. Each suggestion must be realistic for a nutraceutical manufacturer — no exotic compounds, no prescription molecules.

Output format — return EXACTLY one JSON object with this shape, no prose before or after, no markdown fences:

{
  "suggestions": [
    {
      "approach": "<one of: dose-reduction | form-swap | substitution | demographic-scope | add-warning>",
      "changeSummary": "<≤50 words describing exactly what changes on the label>",
      "rationale": "<why this addresses the safety signal, 1-3 sentences>",
      "regulatoryRisk": <number 0-1>,
      "newIngredient": "<optional — only if approach is form-swap or substitution>",
      "newDose": <optional number — only if approach is dose-reduction>,
      "newDoseUnit": "<optional — pairs with newDose>",
      "newWarningText": "<optional — only if approach is add-warning>",
      "warnings": ["<string warning>", ...]
    }
  ]
}

Rules for the output object:
- Produce 3 to 5 suggestions. Do not repeat the same approach unless the tactics are meaningfully different.
- "regulatoryRisk" 0-1: 0 = drop-in safe, 0.3 = mild caution (e.g. claim re-review needed), 0.6 = probable claim impact / disclaimer shift, 0.8+ = likely to need new substantiation or risk regulatory action.
- "warnings" lists things for RA to double-check before accepting: "Check supplier availability for magnesium glycinate", "Reduces PCS 3A claim #4 — may need re-substantiation", "needsNewStudy: true — current PCS evidence doesn't cover this form", "Check state-level warning-label rules (California Prop 65)", etc.
- Do NOT emit markdown, commentary, or wrapping text. Return exactly one JSON object.`;
}

function buildUserPrompt({ label, pcs, flaggedIngredient, currentDose, currentDoseUnit, demographic, safetyEvidence, claims }) {
  const trimmedClaims = (claims || []).map(c => ({
    id: c.id,
    claimNo: c.claimNo || null,
    text: c.claim || '',
    bucket: c.claimBucket || null,
    status: c.claimStatus || null,
    minDoseMg: c.minDoseMg ?? null,
    maxDoseMg: c.maxDoseMg ?? null,
  }));

  const trimmedEvidence = safetyEvidence ? {
    id: safetyEvidence.id,
    name: safetyEvidence.name || null,
    citation: safetyEvidence.citation || null,
    evidenceType: safetyEvidence.evidenceType || null,
    summary: safetyEvidence.canonicalSummary || null,
    safetyDoseThreshold: safetyEvidence.safetyDoseThreshold ?? null,
    safetyDoseUnit: safetyEvidence.safetyDoseUnit || null,
    safetyDemographic: safetyEvidence.safetyDemographicFilterRaw || null,
  } : null;

  const trimmedLabel = label ? {
    id: label.id,
    sku: label.sku || null,
    productNameAsMarketed: label.productNameAsMarketed || null,
    regulatoryFramework: label.regulatoryFramework || null,
    markets: label.markets || [],
    ingredientDoses: label.ingredientDoses || null,
    approvedClaimsOnLabel: label.approvedClaimsOnLabel || null,
  } : null;

  const trimmedPcs = pcs ? {
    id: pcs.id,
    pcsId: pcs.pcsId || null,
    versionId: pcs.versionId || null,
    version: pcs.version || null,
  } : null;

  return `Suggest 3-5 reformulation approaches for the label below. Follow the system prompt exactly.

Label:
${JSON.stringify(trimmedLabel, null, 2)}

Backing PCS (metadata only):
${JSON.stringify(trimmedPcs, null, 2)}

3A claims on the backing PCS:
${JSON.stringify(trimmedClaims, null, 2)}

Flagged ingredient:
${JSON.stringify({
  name: flaggedIngredient || null,
  currentDose: currentDose ?? null,
  currentDoseUnit: currentDoseUnit || null,
  demographic: demographic || null,
}, null, 2)}

Safety evidence that triggered the review:
${JSON.stringify(trimmedEvidence, null, 2)}`;
}

function detectDiseaseVerb(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const verb of DISEASE_CLAIM_VERBS) {
    const rx = new RegExp(`\\b${verb}(?:s|es|ed|ing|er)?\\b`, 'i');
    if (rx.test(lower)) return verb;
  }
  return null;
}

function normalizeOutput(parsed) {
  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

  const normalized = suggestions.map(s => {
    const approach = REFORMULATION_APPROACHES.includes(s.approach) ? s.approach : 'add-warning';
    const changeSummary = typeof s.changeSummary === 'string' ? s.changeSummary : '';
    const rationale = typeof s.rationale === 'string' ? s.rationale : '';
    const warnings = Array.isArray(s.warnings) ? s.warnings.slice() : [];

    // Defensive disease-verb scan across all human-visible fields.
    for (const field of [changeSummary, rationale, s.newWarningText || '']) {
      const verb = detectDiseaseVerb(field);
      if (verb) {
        warnings.push(`SAFETY: suggestion contains disease-claim verb "${verb}" — must not ship as-is.`);
        break;
      }
    }

    let risk = Number(s.regulatoryRisk);
    if (!Number.isFinite(risk)) risk = 0.5;
    if (warnings.some(w => typeof w === 'string' && w.startsWith('SAFETY:'))) risk = 1.0;

    const out = {
      approach,
      changeSummary,
      rationale,
      regulatoryRisk: Math.max(0, Math.min(1, risk)),
      warnings,
    };
    if (s.newIngredient) out.newIngredient = String(s.newIngredient);
    if (s.newDose != null) {
      const nd = Number(s.newDose);
      if (Number.isFinite(nd)) out.newDose = nd;
    }
    if (s.newDoseUnit) out.newDoseUnit = String(s.newDoseUnit);
    if (s.newWarningText) out.newWarningText = String(s.newWarningText);
    return out;
  });

  return { suggestions: normalized };
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try { return JSON.parse(fence[1].trim()); } catch { /* fallthrough */ }
    }
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) {
      try { return JSON.parse(brace[0]); } catch { /* fallthrough */ }
    }
    const preview = text.length > 800 ? text.slice(0, 500) + '…' + text.slice(-200) : text;
    throw new Error(`suggestReformulations: failed to parse JSON from LLM response. Raw:\n${preview}`);
  }
}

/**
 * Suggest reformulation approaches for a safety-flagged label ingredient.
 *
 * @param {object} args
 * @param {object} args.label                  Label row (see src/lib/pcs-labels.js parsePage shape).
 * @param {object} [args.pcs]                  PCS metadata { id, pcsId, versionId, version }.
 * @param {Array}  [args.claims]               Backing 3A claim rows.
 * @param {string} args.flaggedIngredient      Human-readable ingredient name.
 * @param {number} [args.currentDose]          Current dose on the label.
 * @param {string} [args.currentDoseUnit]      e.g. "mg", "mcg".
 * @param {string} [args.demographic]          e.g. "pediatric", "adult".
 * @param {object} [args.safetyEvidence]       Evidence row that triggered the review.
 * @returns {Promise<{ suggestions: Array, promptVersion: string, model: string, cost: object, generatedAt: string }>}
 */
export async function suggestReformulations({
  label,
  pcs,
  claims,
  flaggedIngredient,
  currentDose,
  currentDoseUnit,
  demographic,
  safetyEvidence,
}) {
  if (!label || !label.id) {
    throw new Error('suggestReformulations: label is required');
  }
  if (!flaggedIngredient || typeof flaggedIngredient !== 'string') {
    throw new Error('suggestReformulations: flaggedIngredient is required');
  }
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('suggestReformulations: LLM_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    label,
    pcs,
    flaggedIngredient,
    currentDose,
    currentDoseUnit,
    demographic,
    safetyEvidence,
    claims,
  });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2500,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message?.content?.[0]?.text || '';
  const parsed = parseJSON(text);
  const normalized = normalizeOutput(parsed);

  return {
    ...normalized,
    promptVersion: REFORMULATION_PROMPT_VERSION,
    model: DEFAULT_MODEL,
    cost: estimateCost(Array.isArray(claims) ? claims.length : 0),
    generatedAt: new Date().toISOString(),
  };
}
