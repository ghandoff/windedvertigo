/**
 * AICS Dossier Import — extract structured AICS document data from a PDF
 * substantiation dossier using Claude.
 *
 * Unlike pcs-pdf-import.js (which handles PCS product labels), this module
 * targets AICS (Active Ingredient Component Specification) dossiers — ingredient-
 * level documents that describe clinical substantiation for health claims.
 *
 * Uses Claude Haiku for speed and cost efficiency (AICS dossiers are structurally
 * simpler than PCS product labels).
 *
 * Returns a document object shaped for POST /api/pcs/aics/batch.
 */

const LLM_API_KEY = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;

// Use Haiku — AICS dossiers are simpler than PCS product labels
const EXTRACTION_MODEL = process.env.AICS_EXTRACTION_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are extracting structured data from an Active Ingredient Component Specification (AICS) substantiation dossier.

An AICS dossier documents the scientific evidence for health claims associated with a specific active ingredient used in dietary supplements.

Extract the following information and return ONLY valid JSON matching the schema below — no prose, no markdown fencing, no explanations:

{
  "aicsId": "",
  "aiName": "exact ingredient name from document",
  "classification": "one of: Vitamin, Mineral, Omega-3, Omega-6, Amino acid, Herbal, Probiotic, Botanical extract, Enzyme, Other",
  "fileStatus": "Draft",
  "raReviewStatus": "Pending RA Review",
  "demographic": "one of: Infants (0-12mo), Children (1-3y), Children (4-8y), Children (9-13y), Adolescents (14-18y), Adults (19-50y), Adults (51+), Pregnant/Lactating, All ages — or null if not specified",
  "versions": [
    {
      "version": "1.0",
      "effectiveDate": null,
      "changeDescription": "Initial dossier",
      "isLatest": true,
      "claims": [
        {
          "claimId": "C-001",
          "claimText": "exact health claim text from document",
          "benefitCategory": "primary health benefit category (e.g. Bone & joint, Cardiovascular health, Immune support, etc.)",
          "grade": "A, B, or C based on evidence strength — A=strong RCTs, B=moderate evidence, C=limited/mechanistic",
          "ageGroup": "target age group for this claim, or null",
          "minDose": null,
          "minDoseUnit": "mg, mcg, IU, or %DV — or null",
          "warnings": []
        }
      ]
    }
  ],
  "_extractionWarnings": []
}

Rules:
- Leave aicsId as empty string — the user will fill it in before importing
- Number claimIds sequentially: C-001, C-002, etc.
- Only include claims that are clearly stated health benefit claims in the dossier
- For minDose, extract the minimum studied or recommended dose; leave null if not clearly stated
- For grade: use the strength of the clinical evidence in the dossier (RCT evidence = A, observational/epidemiological = B, mechanistic/in vitro = C)
- _extractionWarnings is a flat string array for any caveats or ambiguities you encountered
- If you cannot confidently extract a field, use null (not an empty string, except for claimId/claimText which must be non-empty)`;

/**
 * Extract AICS document structure from a PDF substantiation dossier.
 *
 * @param {Buffer|ArrayBuffer} pdfBuffer - Raw PDF bytes
 * @param {string} filename - Original filename (for context in the prompt)
 * @returns {Promise<{ doc: object, warnings: string[] }>}
 */
export async function extractFromAicsDossier(pdfBuffer, filename) {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY (or ANTHROPIC_API_KEY) is not configured');
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const safeName = (filename || 'aics-dossier.pdf').replace(/[^A-Za-z0-9._\- ]/g, '');
  const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

  const stream = client.messages.stream({
    model: EXTRACTION_MODEL,
    max_tokens: 8000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            type: 'text',
            text: `Extract all structured data from this AICS substantiation dossier (filename: "${safeName}") following the schema in your system prompt. Return a single JSON object only — no prose before or after.`,
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();
  const rawText = message.content?.[0]?.text || '';

  // Strip any accidental markdown fencing
  const jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`AICS extraction returned invalid JSON: ${err.message}. Raw (first 500 chars): ${rawText.slice(0, 500)}`);
  }

  const warnings = Array.isArray(parsed._extractionWarnings) ? parsed._extractionWarnings : [];
  delete parsed._extractionWarnings;

  // Auto-fill aicsId from filename when the AI left it blank.
  // Handles patterns like "AICS-0002v1.0_Vit D3 Adults.pdf" → "AICS-0002".
  if (!parsed.aicsId && filename) {
    const m = filename.match(/^(AICS[-_]?\d{3,4})/i);
    if (m) {
      parsed.aicsId = m[1].toUpperCase().replace('_', '-');
      warnings.push(`aicsId auto-filled from filename as "${parsed.aicsId}" — verify this is correct before importing`);
    }
  }

  // Ensure required shape
  if (!parsed.versions || !Array.isArray(parsed.versions)) {
    parsed.versions = [];
  }
  if (parsed.versions.length === 0) {
    parsed.versions = [{ version: '1.0', effectiveDate: null, changeDescription: 'Initial dossier', isLatest: true, claims: [] }];
    warnings.push('No version/claims found in document — created empty version placeholder');
  }

  return { doc: parsed, warnings };
}
