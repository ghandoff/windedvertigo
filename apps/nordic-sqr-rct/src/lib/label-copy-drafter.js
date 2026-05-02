/**
 * Label copy drafter (Wave 5.5 — added 2026-04-21).
 *
 * Given a set of 3A-approved PCS claims, returns LLM-drafted consumer-facing
 * label copy variants under a specified regulatory framework, tone, and
 * character budget. The module is PURE — it never writes to Notion or anywhere
 * else; callers receive ephemeral suggestions for a human to review + copy.
 *
 * Hard safety rule (embedded in the prompt): never write; always draft.
 *
 * See docs/plans/wave-5-product-labels.md §7 for the user story, UX sketch,
 * and prompt shape this module implements.
 *
 * Environment:
 *   LLM_API_KEY          — Anthropic API key (required).
 *   LABEL_COPY_MODEL     — override default model. Default: claude-sonnet-4-5.
 */

export const LABEL_COPY_PROMPT_VERSION = 'v1-initial';

const DEFAULT_MODEL = process.env.LABEL_COPY_MODEL || 'claude-sonnet-4-5';

export const REGULATORY_FRAMEWORKS = Object.freeze([
  'FDA (US)',
  'Health Canada',
  'EU EFSA',
]);

export const TONES = Object.freeze(['clinical', 'consumer', 'athletic']);

export const CHAR_BUDGETS = Object.freeze({
  short: 25,
  medium: 40,
  long: 80,
});

/** Claude Sonnet 4.5 list-price as of Wave 5.5 planning (2026-04-21). */
export const MODEL_PRICING = Object.freeze({
  inputPerMTok: 3.0,   // USD per 1M input tokens
  outputPerMTok: 15.0, // USD per 1M output tokens
});

/** Disease-claim verbs that must never appear in a draft (FDA/DSHEA hard rule). */
const DISEASE_CLAIM_VERBS = ['treat', 'cure', 'prevent', 'diagnose', 'heal'];

/**
 * Rough cost estimate for a drafting run. Assumes ~350 input tokens of prompt
 * overhead + ~120 tokens per claim for payload, and ~300 output tokens per
 * claim (3 variants + annotations). Deliberately pessimistic so we don't
 * undershoot the confirm-threshold. See MODEL_PRICING for price assumptions.
 *
 * @param {number} claimCount - Number of claims about to be drafted for.
 * @returns {{ estUsd: number, inputTokens: number, outputTokens: number }}
 */
export function estimateCost(claimCount) {
  const n = Math.max(0, Number(claimCount) || 0);
  const inputTokens = 350 + 120 * n;
  const outputTokens = 300 * n;
  const estUsd =
    (inputTokens / 1_000_000) * MODEL_PRICING.inputPerMTok +
    (outputTokens / 1_000_000) * MODEL_PRICING.outputPerMTok;
  return {
    estUsd: Math.round(estUsd * 10_000) / 10_000,
    inputTokens,
    outputTokens,
  };
}

function budgetLabelFor(charBudget) {
  const limit = CHAR_BUDGETS[charBudget];
  if (!limit) return null;
  return `${charBudget} (≤${limit} characters)`;
}

function buildSystemPrompt({ regulatoryFramework, tone, charBudget }) {
  const budgetLabel = budgetLabelFor(charBudget) || 'medium (≤40 characters)';
  return `You are a regulatory-savvy consumer copywriter who drafts dietary-supplement label claim variants from substantiated PCS (Product Concept Substantiation) claims.

You are a DRAFTER, not a publisher. Your output is ephemeral suggestion copy for a human reviewer. You NEVER auto-publish; a human will approve or reject every variant before it reaches a label. The phrase "never write; always draft" governs every response.

Constraints for this run:
- Regulatory framework: ${regulatoryFramework}
- Tone: ${tone}
- Character budget per variant: ${budgetLabel}

Hard rules (violating any of these is a critical failure):
1. NEVER use the following disease-claim verbs in any variant: ${DISEASE_CLAIM_VERBS.join(', ')} (or their inflections like "treats", "curing", "prevents", "diagnoses", "heals", "healing").
2. NEVER add a claim, benefit, ingredient, or population that is not present in the source PCS claim. You may rephrase; you may not expand scope.
3. NEVER invent quantitative statements ("50% stronger", "clinically proven in 30 days") that are not in the source.
4. Preserve causal structure when the source has it: ingredient → benefit → (optional) population. Do not drop the ingredient if the source names one.
5. Stay within the character budget. Drafts that exceed the budget must be flagged in warnings and their risk raised.

Framework-specific guidance:
- "FDA (US)": Structure/function claims only under DSHEA. Words like "supports", "helps maintain", "promotes", "contributes to" are admissible. The claim requires the "This statement has not been evaluated by the FDA" disclaimer — note this in warnings when you use structure/function verbs.
- "Health Canada": Natural Health Product (NHPD) monograph-style language. Prefer evidence-based phrasing ("helps support", "a factor in the maintenance of good health"). Disease claims are similarly forbidden.
- "EU EFSA": Only EFSA-authorised health claim wordings should be used verbatim or close to verbatim. If the source claim maps to an authorised claim, reference the pattern; otherwise flag high risk because unauthorised claims cannot appear on pack.

Tone guidance:
- "clinical": precise, scientific register, sparing use of superlatives.
- "consumer": warm, plain-English, benefit-first.
- "athletic": action-oriented, performance-framed, still evidence-anchored.

Output format — return EXACTLY one JSON object with this shape, no prose before or after, no markdown fences:

{
  "variants": [
    {
      "claimId": "<source claim id>",
      "sourceClaimText": "<source claim text, echoed for traceability>",
      "drafts": [
        {
          "text": "<variant copy>",
          "charCount": <integer>,
          "regulatoryRisk": <number 0-1>,
          "warnings": ["<string warning>", ...]
        }
      ]
    }
  ]
}

Rules for the output object:
- Produce exactly 3 drafts per claim.
- "regulatoryRisk" is your honest self-assessment 0–1 for the chosen regulatory framework. 0 = boilerplate-safe; 0.3 = mild caution; 0.6 = disclaimer required / close to line; 0.8+ = likely non-compliant.
- "warnings" lists concrete issues: disclaimer-required verbs ("uses 'supports' which requires DSHEA disclaimer"), borderline phrasing ("'boosts' may imply drug-like action"), character-budget overruns, missing ingredient attribution, etc. Empty array is fine if truly clean.
- "charCount" = the exact Number of characters in "text".
- Never emit markdown, commentary, or any wrapping text. Return exactly one JSON object.`;
}

function buildUserPrompt(pcsClaims) {
  const trimmed = pcsClaims.map(c => ({
    id: c.id,
    claimNo: c.claimNo || null,
    text: c.claim || '',
    bucket: c.claimBucket || null,
    status: c.claimStatus || null,
    disclaimerRequired: !!c.disclaimerRequired,
    minDoseMg: c.minDoseMg ?? null,
    maxDoseMg: c.maxDoseMg ?? null,
    doseGuidanceNote: c.doseGuidanceNote || null,
  }));
  return `Draft 3 label copy variants per claim for the claims below. Follow the system prompt exactly.

Source claims (JSON):
${JSON.stringify(trimmed, null, 2)}`;
}

/** Local sanity check — used only to annotate dangerous outputs post-hoc. */
function detectDiseaseVerb(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const verb of DISEASE_CLAIM_VERBS) {
    // loose inflection match: "heal", "heals", "healed", "healing", "healer"
    const rx = new RegExp(`\\b${verb}(?:s|es|ed|ing|er)?\\b`, 'i');
    if (rx.test(lower)) return verb;
  }
  return null;
}

/**
 * Validate and normalize the drafter output. Adds defensive warnings if the
 * LLM slipped a disease verb past its own filter, and coerces types.
 */
function normalizeOutput(parsed, pcsClaims, charBudget) {
  const limit = CHAR_BUDGETS[charBudget] || null;
  const claimsById = new Map(pcsClaims.map(c => [c.id, c]));
  const variants = Array.isArray(parsed?.variants) ? parsed.variants : [];

  const normalized = variants.map(v => {
    const claim = claimsById.get(v.claimId);
    const drafts = Array.isArray(v.drafts) ? v.drafts : [];
    return {
      claimId: v.claimId,
      sourceClaimText: v.sourceClaimText || claim?.claim || '',
      sourceClaimNo: claim?.claimNo || null,
      drafts: drafts.map(d => {
        const text = typeof d.text === 'string' ? d.text : '';
        const warnings = Array.isArray(d.warnings) ? d.warnings.slice() : [];
        const diseaseVerb = detectDiseaseVerb(text);
        if (diseaseVerb) {
          warnings.push(
            `SAFETY: draft contains disease-claim verb "${diseaseVerb}" — must not ship.`
          );
        }
        const charCount = typeof d.charCount === 'number' ? d.charCount : text.length;
        if (limit && charCount > limit) {
          warnings.push(`Exceeds ${charBudget} budget (${charCount} > ${limit} chars).`);
        }
        let risk = Number(d.regulatoryRisk);
        if (!Number.isFinite(risk)) risk = 0.5;
        // Disease verb forces risk to max, independent of what the LLM said.
        if (diseaseVerb) risk = 1.0;
        return {
          text,
          charCount,
          regulatoryRisk: Math.max(0, Math.min(1, risk)),
          warnings,
        };
      }),
    };
  });

  return { variants: normalized };
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
    throw new Error(`draftLabelCopy: failed to parse JSON from LLM response. Raw:\n${preview}`);
  }
}

/**
 * Draft consumer-facing label copy variants from substantiated PCS claims.
 *
 * @param {object} args
 * @param {Array} args.pcsClaims - Array of PCS claim rows (see src/lib/pcs-claims.js parsePage shape).
 * @param {'FDA (US)'|'Health Canada'|'EU EFSA'} args.regulatoryFramework
 * @param {'clinical'|'consumer'|'athletic'} args.tone
 * @param {'short'|'medium'|'long'} args.charBudget
 * @returns {Promise<{ variants: Array, promptVersion: string, model: string, cost: object }>}
 */
export async function draftLabelCopy({ pcsClaims, regulatoryFramework, tone, charBudget }) {
  if (!Array.isArray(pcsClaims) || pcsClaims.length === 0) {
    throw new Error('draftLabelCopy: pcsClaims must be a non-empty array');
  }
  if (!REGULATORY_FRAMEWORKS.includes(regulatoryFramework)) {
    throw new Error(`draftLabelCopy: invalid regulatoryFramework "${regulatoryFramework}" (expected one of ${REGULATORY_FRAMEWORKS.join(', ')})`);
  }
  if (!TONES.includes(tone)) {
    throw new Error(`draftLabelCopy: invalid tone "${tone}" (expected one of ${TONES.join(', ')})`);
  }
  if (!CHAR_BUDGETS[charBudget]) {
    throw new Error(`draftLabelCopy: invalid charBudget "${charBudget}" (expected one of ${Object.keys(CHAR_BUDGETS).join(', ')})`);
  }
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('draftLabelCopy: LLM_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt({ regulatoryFramework, tone, charBudget });
  const userPrompt = buildUserPrompt(pcsClaims);

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: Math.min(8000, 500 + 400 * pcsClaims.length),
    temperature: 0.4, // small amount of variety across the 3 variants
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message?.content?.[0]?.text || '';
  const parsed = parseJSON(text);
  const normalized = normalizeOutput(parsed, pcsClaims, charBudget);

  return {
    ...normalized,
    promptVersion: LABEL_COPY_PROMPT_VERSION,
    model: DEFAULT_MODEL,
    regulatoryFramework,
    tone,
    charBudget,
    cost: estimateCost(pcsClaims.length),
    generatedAt: new Date().toISOString(),
  };
}
