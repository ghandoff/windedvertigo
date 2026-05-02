/**
 * PCS PDF Import — Claude-powered extraction of structured data from PCS product labels.
 *
 * 5-phase extraction process:
 *   1. Document & Version metadata
 *   2. Formula / Supplement Facts
 *   3. Claims (3A / 3B / 3C buckets)
 *   4. References / Bibliography
 *   5. Revision History
 *
 * Uses Claude's vision capability to read PDF pages as images,
 * then extracts structured JSON for each phase.
 *
 * TODO (Wave 3.8.1): Filename is now misleading — this module handles both
 * PDF and DOCX inputs since Wave 3.8. Rename to `pcs-doc-import.js` in a
 * follow-up wave (separate PR; renaming now would touch too many imports).
 */

// Wave 3.8 — MIME types accepted by the extraction pipeline. DOCX is
// converted to Markdown server-side (see docx-to-markdown.js) and fed to
// Claude as a text prompt; PDFs continue to use the `document` block.
const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929';

/**
 * Haiku model used for the cheap schema pre-flight classifier. Overridable
 * via env so ops can swap it if the model ID changes without a redeploy.
 */
export const HAIKU_MODEL = process.env.PREFLIGHT_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Bump this string whenever buildSystemPrompt changes materially. Stored on
 * each import job so the batch-import dashboard can flag committed jobs that
 * were extracted under a stale prompt (and offer bulk re-extract).
 */
export const PROMPT_VERSION = 'v2.2-confidence';

/**
 * Extract all structured data from a PCS document (PDF or DOCX) in a single
 * Claude call. PDFs are sent as a base64 `document` block; DOCX files are
 * server-side converted to Markdown (preserving tables) and sent as text —
 * the downstream JSON schema is identical either way.
 *
 * @param {Buffer|ArrayBuffer} docBuffer - The raw document bytes (PDF or DOCX).
 * @param {string} filename - Original filename (for context).
 * @param {object} [opts]
 * @param {string} [opts.mimeType] - MIME type of the buffer. Defaults to
 *   `application/pdf` for backward compatibility with existing callers.
 *   Set to the DOCX MIME to take the Markdown branch.
 * @returns {Promise<object>} Extracted data across all 5 phases, plus
 *   `warnings[]`, `promptVersion`, and `sourceFormat` ('pdf' | 'docx').
 */
export async function extractFromPdf(docBuffer, filename, opts = {}) {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY is not configured');
  }

  const mimeType = opts?.mimeType || MIME_PDF;
  const isDocx = mimeType === MIME_DOCX;
  const sourceFormat = isDocx ? 'docx' : 'pdf';
  const warnings = [];

  // Fetch live vocabularies ONCE so the SYSTEM_PROMPT targets the real,
  // non-archived taxonomy (Claim Prefixes + Benefit Categories). Hard-coding
  // these was the root cause of bucket-3A claims getting mis-tagged after the
  // CAIPB cleanup archived most of the old rows.
  const { getAllPrefixes } = await import('./pcs-prefixes.js');
  const { getAllBenefitCategories } = await import('./pcs-benefit-categories.js');
  const [prefixRows, benefitCategoryRows] = await Promise.all([
    getAllPrefixes().catch(err => {
      warnings.push(`Failed to load Claim Prefixes vocabulary: ${err?.message || err}`);
      return [];
    }),
    getAllBenefitCategories().catch(err => {
      warnings.push(`Failed to load Benefit Categories vocabulary: ${err?.message || err}`);
      return [];
    }),
  ]);
  const prefixVocab = prefixRows.map(p => p.prefix).filter(Boolean);
  const benefitCategoryVocab = benefitCategoryRows.map(c => c.name).filter(Boolean);

  const systemPrompt = buildSystemPrompt({ prefixVocab, benefitCategoryVocab });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const safeName = (filename || 'upload').replace(/[^A-Za-z0-9._\- ]/g, '');

  // Build the user-turn content array. Two branches:
  //   - PDF   → base64 `document` block (Claude's PDF understanding mode)
  //   - DOCX  → convert to Markdown via mammoth, send as text block
  // Both branches end with the same "extract per schema" text block so the
  // model sees an identical task specification regardless of input format.
  let userContent;
  if (isDocx) {
    const { convertDocxToMarkdown } = await import('./docx-to-markdown.js');
    const conv = await convertDocxToMarkdown(Buffer.from(docBuffer));
    for (const w of conv.warnings) warnings.push(`[DOCX] ${w}`);
    if (conv.images > 0) {
      warnings.push(`[DOCX] ${conv.images} embedded image(s) detected — images are not extracted in v1; structured text and tables will be processed normally.`);
    }
    if (!conv.markdown || conv.markdown.trim().length === 0) {
      throw new Error('DOCX → Markdown conversion produced empty output');
    }
    userContent = [
      {
        type: 'text',
        text:
          `Here is a PCS document authored in Microsoft Word (filename: "${safeName}"). ` +
          `The content has been converted to Markdown with tables preserved. Extract per the schema below.\n\n` +
          `<markdown>\n${conv.markdown}\n</markdown>\n\n` +
          `Extract all structured data from this PCS document following the schema in your system prompt. Return a single JSON object, no prose before or after.`,
      },
    ];
  } else {
    const base64Pdf = Buffer.from(docBuffer).toString('base64');
    userContent = [
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
        text: `Extract all structured data from this PCS document (filename: "${safeName}") following the schema in your system prompt. Return a single JSON object, no prose before or after.`,
      },
    ];
  }

  // Use streaming. Anthropic SDK requires streaming for operations that
  // may exceed 10 minutes, which a 32K-token PCS extraction can. The
  // .finalMessage() helper assembles the stream back into the standard
  // Message shape, so the rest of the code below is unchanged.
  const stream = client.messages.stream({
    model: LLM_MODEL,
    // Raised from 8000 → 16000 → 32000 after the Lauren-template migration
    // expanded the output schema (Tables 4/5/6 narrative fields, dose
    // requirements, product details). An Omega-D3 PCS with ~15 evidence
    // packets × full narrative (key takeaway, study design, N, positive/
    // neutral/negative results, biases) produces ~50K chars ≈ 12-15K tokens
    // of JSON alone; Claude Sonnet 4.5 supports up to 64K output tokens so
    // 32K is a comfortable ceiling with headroom for heavier PCS documents.
    max_tokens: 32000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });
  const message = await stream.finalMessage();

  const text = message.content[0]?.text || '';
  let parsed;
  try {
    parsed = parseExtraction(text);
  } catch (err) {
    // Surface the raw response head so the caller can diagnose truncation
    // vs. malformed JSON vs. Claude adding prose.
    const stopReason = message.stop_reason || 'unknown';
    const preview = text.length > 1200 ? text.slice(0, 600) + '\n…[truncated]…\n' + text.slice(-400) : text;
    throw new Error(
      `Failed to parse extraction response from Claude (stop_reason=${stopReason}, ${text.length} chars). ` +
      `Raw response:\n${preview}`
    );
  }
  parsed.warnings = [...(Array.isArray(parsed.warnings) ? parsed.warnings : []), ...warnings];
  parsed.promptVersion = PROMPT_VERSION;
  parsed.sourceFormat = sourceFormat; // Wave 3.8 — audit trail: 'pdf' | 'docx'
  return parsed;
}

/**
 * Maximum chars of Markdown fed to the Haiku preflight classifier for DOCX
 * inputs. A typical Lauren-template PCS converts to ~40-80KB of Markdown;
 * 8000 chars (~2000 tokens) is more than enough for Haiku to identify PCS
 * structure (PCS ID, claim tables, dose requirements) while keeping the
 * preflight cheap. Full extraction gets the complete Markdown separately.
 */
const DOCX_PREFLIGHT_CHAR_LIMIT = 8000;

/**
 * Run a cheap Haiku classifier on a document to decide whether it's a Nordic
 * Naturals PCS before spending a full Sonnet extraction call.
 *
 * Fails OPEN: if parsing or classification fails, the caller should still
 * proceed to full extraction — the extractor has its own validation.
 * Network/rate-limit errors are thrown so the caller can decide.
 *
 * Wave 3.8: added optional `opts.mimeType` to route DOCX inputs through a
 * Markdown-text branch instead of the PDF `document` block.
 *
 * @param {Buffer|ArrayBuffer} docBuffer - Raw document bytes (PDF or DOCX).
 * @param {string} filename - Original filename, surfaced for context.
 * @param {object} [opts]
 * @param {string} [opts.mimeType] - MIME type; defaults to application/pdf.
 * @returns {Promise<{isPcs: boolean, confidence: number, docType: string, reason: string}>}
 */
export async function preflightCheckPdf(docBuffer, filename, opts = {}) {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY is not configured');
  }

  const mimeType = opts?.mimeType || MIME_PDF;
  const isDocx = mimeType === MIME_DOCX;

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const systemPrompt = 'You are a document classifier. Given a document, determine if it is a Nordic Naturals PCS (Product Claim Substantiation) document. PCS documents have: a PCS ID (e.g., PCS-0051), tables of claims with regulatory prefixes, dose requirements for active ingredients, and evidence packets. Return JSON only, no commentary. Schema: {"isPcs": boolean, "confidence": number 0-1, "docType": string (e.g. "PCS" | "research paper" | "invoice" | "unknown"), "reason": string (1 sentence)}';

  const safeName = (filename || 'upload').replace(/[^A-Za-z0-9._\- ]/g, '');

  let userContent;
  if (isDocx) {
    const { convertDocxToMarkdown } = await import('./docx-to-markdown.js');
    // Conversion failures bubble up; caller's fail-open already handles this.
    const conv = await convertDocxToMarkdown(Buffer.from(docBuffer));
    const preview = (conv.markdown || '').slice(0, DOCX_PREFLIGHT_CHAR_LIMIT);
    userContent = [
      {
        type: 'text',
        text:
          `Classify the attached document (filename: "${safeName}", format: DOCX converted to Markdown; showing first ${preview.length} chars).\n\n` +
          `<markdown>\n${preview}\n</markdown>`,
      },
    ];
  } else {
    const base64Pdf = Buffer.from(docBuffer).toString('base64');
    userContent = [
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
        text: `Classify the attached PDF (filename: "${safeName}").`,
      },
    ];
  }

  const message = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  const text = message?.content?.[0]?.text || '';
  // Fail-open defaults — used when we can't parse the classifier response.
  const failOpen = {
    isPcs: true,
    confidence: 0,
    docType: 'unknown',
    reason: 'pre-flight parse failed; proceeded to full extraction',
  };
  try {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1].trim());
      } else {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        } else {
          return failOpen;
        }
      }
    }
    return {
      isPcs: typeof parsed.isPcs === 'boolean' ? parsed.isPcs : true,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      docType: typeof parsed.docType === 'string' ? parsed.docType : 'unknown',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch {
    return failOpen;
  }
}

/**
 * Parse Claude's response into structured extraction data.
 */
function parseExtraction(text) {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch { /* fall through */ }
    }
    // Try finding first { ... } block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch { /* fall through */ }
    }
    throw new Error('Failed to parse extraction response from Claude');
  }
}

/**
 * Build the extraction SYSTEM prompt with LIVE vocabularies substituted in.
 *
 * The prefix list + benefit-category list are fetched from Notion at runtime
 * (see extractFromPdf). Hard-coding them was the root cause of a regression
 * where the CAIPB cleanup archived most of the old rows and the LLM kept
 * emitting dead values.
 */
function buildSystemPrompt({ prefixVocab, benefitCategoryVocab }) {
  return `You are a regulatory science data extraction system for Nordic Naturals' Product Claim Substantiation (PCS) documents.

Nordic Naturals PCS documents follow a standardized 10-table template authored by Lauren Bozzio (Nordic Research Dept.). You must recognize each table and extract its structured data.

## Template structure

- **Cover page** — PCS ID, version, product name at top
- **Table A — Document Revision History** — version log with dual (RES + RA) approvals
- **Table B — Applicable NN Products** — Finished Good Name, FMT, SAP Material No., SKUs
- **Table 1 — Product Details** — Product Name, Format, Demographic
- **Table 2 — Product Composition** — supplement-facts-style ingredients: FM PLM #, AI Source, AI Form, AI, Amount per serving (with unit), % Daily Value. Includes Daily Serving Size header and optional EPA+DHA / Omega-6 / Omega-9 totals footnotes.
- **Table 3A — Approved Claims** — claim, claim no., claim status (3A), and minimum AI dose(s) required. Multiple AIs with OR logic: "Vitamin D 600 IU OR Magnesium 200 mg" means either alone substantiates the claim.
- **Table 3B — Unacceptable Claims** — claim text + note (bucket 3B)
- **Table 3C — Ineligible/NA Claims** — claim + min dose required (bucket 3C)
- **Table 4 — Summary of Research for Claim Substantiation** — per-claim primary studies with structured narrative: Key Takeaway, Sample size, Study design, Measurements, Statistical methods, Potential biases, Positive/Neutral/Negative results.
- **Table 5 — Supporting Documentation** — non-RCT evidence (monographs, reviews) with "how does this support the claim(s)?" narrative
- **Table 6 — Null Results with Appropriate Dose and Population** — null-result studies with rationale for why they don't contradict the claim

## Evidence Tier Definitions (claim bucket)
- **3A**: Claims with sufficient evidence at labeled dose — Approved/Applicable
- **3B**: Unacceptable Claims — Not approved for the product
- **3C**: Ineligible/NA — Not applicable to this product but authorized for the minimum AI dose indicated

## Output Schema

Return a single JSON object:

{
  "document": {
    "pcsId": "string — PCS ID (e.g., 'PCS-0126')",
    "classification": "string or null",
    "productStatus": "string or null — 'On-market', 'In development', 'Retired', or 'Unknown'",
    "approvedDate": "string or null — ISO date",
    "documentNotes": "string or null",
    "finishedGoodName": "string or null — from Table B",
    "fmt": "string or null — one of: Softgel, Capsule, Gummy, Liquid, Powder, Tablet, Chewable, Other",
    "sapMaterialNo": "string or null — from Table B",
    "skus": ["string"]  // from Table B, empty array if not listed
  },
  "version": {
    "version": "string — e.g., 'v2.1', 'v1.0'",
    "effectiveDate": "string or null — ISO date",
    "versionNotes": "string or null",
    "productName": "string or null — from Table 1",
    "formatOverride": "string or null — only if document.fmt == 'Other'",
    "demographic": {
      // Wave 4.1a — four orthogonal axes. Each axis is optional; include only axes explicitly mentioned in the PCS.
      // Do NOT impose enum values — emit the label(s) as written in Table 1.
      "biologicalSex": ["string"],  // e.g., ['Male'], ['Female'], ['Any sex']
      "ageGroup": ["string"],       // e.g., ['Children (4-8y)', 'Adults (19-50y)']
      "lifeStage": ["string"],      // e.g., ['Prenatal', 'Lactating', 'Infant']
      "lifestyle": ["string"]       // e.g., ['Athlete', 'Vegan', 'Pet parent']
    },
    "dailyServingSize": "string or null — e.g., '1 softgel', '2 capsules' (from Table 2 header)",
    "totalEPA": "number or null — mg",
    "totalDHA": "number or null — mg",
    "totalEPAandDHA": "number or null — mg combined",
    "totalOmega6": "number or null — mg",
    "totalOmega9": "number or null — mg"
  },
  "formulaLines": [
    {
      "fmPlm": "string or null — Finished Material PLM number from Table 2 column 1",
      "ingredientSource": "string or null — AI Source, Table 2 column 2",
      "aiForm": "string or null — AI Form, Table 2 column 3 (e.g. 'cholecalciferol')",
      "ai": "string or null — the active ingredient, Table 2 column 4 (e.g. 'Vitamin D3')",
      "amountPerServing": "number or null — Table 2 column 5",
      "amountUnit": "string or null — one of: mg, mcg, g, IU, CFU, billion CFU, %",
      "percentDailyValue": "number or null — Table 2 column 6",
      "sourcePage": "number or null — 1-indexed PDF page where this item was observed. Null if it spans pages or page is unknown.",
      "confidence": "number 0.0-1.0 — your estimated accuracy of this extraction"
    }
  ],
  "claims": [
    {
      "claimNo": "number — sequential claim number",
      "claim": "string — full claim text as written",
      "claimBucket": "string — '3A', '3B', or '3C'",
      "claimStatus": "string or null — 'Authorized', 'Proposed', 'Not approved', 'NA', 'Unknown'",
      "disclaimerRequired": "boolean",
      "claimNotes": "string or null",
      "prefix": "string or null — emit the EXACT prefix text as it appears at the start of the claim. Must be one of: ${JSON.stringify(prefixVocab)}. These may be compound equivalence classes separated by '/' — emit the full class string verbatim. Same core benefit + different prefix = DIFFERENT canonical claim (per Lauren's CAI-PBE design). If no prefix is clearly identifiable, emit null.",
      "coreBenefit": "string or null — emit the prefix-stripped claim body (the crux of what the claim says). E.g. for 'supports normal mood' → coreBenefit = 'normal mood'. For 'plays a critical role in cellular energy production' → coreBenefit = 'cellular energy production'.",
      "benefitCategory": "string or null — coarse benefit category. Must be one of: ${JSON.stringify(benefitCategoryVocab)}. If unclear, emit null.",
      "doseRequirements": [
        {
          "ai": "string — active ingredient name (e.g. 'Magnesium')",
          "aiForm": "string or null — specific form if required",
          "amount": "number",
          "unit": "string — one of: mg, mcg, g, IU, CFU, billion CFU, %",
          "combinationGroup": "number — if the PCS says the dose requirements must ALL be met together (AND), use the same group number across them. If the PCS says ANY ONE can satisfy the claim (OR), assign a DIFFERENT group number to each alternative (1, 2, 3...). When in doubt, default to a distinct group per requirement (treats as OR), since AND semantics are rare in dietary supplements."
        }
      ],
      "sourcePage": "number or null — 1-indexed PDF page where this claim was observed. Null if it spans pages or page is unknown.",
      "confidence": "number 0.0-1.0 — your estimated accuracy of this extraction"
    }
  ],
  "evidencePackets": [
    {
      "claimNos": ["number"],  // which claim numbers this packet supports
      "substantiationTier": "string — one of: 'Table 4 (primary study)', 'Table 5 (supporting doc)', 'Table 6 (null result)', 'Not shown'",
      "studyDoseAI": "string or null — the AI tested in this study (e.g. 'EPA')",
      "studyDoseAmount": "number or null",
      "studyDoseUnit": "string or null — unit enum as above",
      "keyTakeaway": "string or null — 1-sentence summary for Table 4/5",
      "studyDesignSummary": "string or null — controls, classification, duration",
      "sampleSize": "number or null — N",
      "positiveResults": "string or null — supportive findings, include p-values",
      "neutralResults": "string or null",
      "negativeResults": "string or null",
      "potentialBiases": "string or null",
      "nullResultRationale": "string or null — required for Table 6",
      "citationLabel": "string or null — link text used in the PCS (e.g. '[1]' or '1.')",
      "citationText": "string or null — full citation as written",
      "sourcePage": "number or null — 1-indexed PDF page where this evidence packet was observed. Null if it spans pages or page is unknown.",
      "confidence": "number 0.0-1.0 — your estimated accuracy of this extraction"
    }
  ],
  "references": [
    {
      "label": "string — reference label as written (e.g., '[1]')",
      "referenceText": "string — full citation",
      "referenceNotes": "string or null",
      "sourcePage": "number or null — 1-indexed PDF page where this reference was observed. Null if unknown."
    }
  ],
  "revisionHistory": [
    {
      "event": "string — brief title of the event",
      "activityType": "string — one of: 'FC – Draft/Revise Substantiation', 'FC – Evaluate / Add to / Revise Substantiation', 'File creation (FC)', 'File modification (FM)', 'Review & approve', 'Evaluate / revise substantiation', 'Other'. IMPORTANT: never emit commas in this value — Notion rejects them in select options. If Lauren's template text uses commas (e.g. 'Evaluate, Add to, &/or Revise'), convert them to ' / ' (space-slash-space).",
      "responsibleDept": "string or null — 'RES', 'RA', or 'Other'",
      "approverAlias": "string or null — first+last initial of approver (e.g. 'LB')",
      "approverDepartment": "string or null — 'Research (RES)' or 'Regulatory Affairs (RA)' — populate when Table A shows an approved-by row",
      "startDate": "string or null — ISO date",
      "endDate": "string or null — ISO date",
      "fromVersion": "string or null",
      "toVersion": "string or null",
      "eventNotes": "string or null"
    }
  ]
}

## Extraction rules

1. Extract data EXACTLY as written. Do not paraphrase claims or results.
2. If a section is not present, return an empty array (for lists) or null (for scalars).
3. Table 3A claims map to claimBucket='3A', Table 3B → '3B', Table 3C → '3C'.
4. For claim dose requirements, decide AND vs OR based on the PCS language:
   - "OR" logic (most common — "Vit D 600 IU OR Mg 200 mg", or dose rows listed as independent alternatives): create one row per alternative and assign a DIFFERENT combinationGroup to each (1, 2, 3, …). Rows in different groups are OR.
   - "AND" logic (rare — the PCS explicitly says "both required" or "plus" between requirements): share the SAME combinationGroup across all rows that must be met together.
   - When in doubt, prefer OR (distinct groups). AND semantics are uncommon in dietary-supplement claim dose requirements.
5. Table 2 decomposition: split the ingredient row into ai (the bare active ingredient) and aiForm (the specific chemical form). Example: "Vitamin D3 (as cholecalciferol)" → ai="Vitamin D3", aiForm="cholecalciferol". "Magnesium Bisglycinate Chelate (TRAACS®)" → ai="Magnesium", aiForm="bisglycinate chelate", ingredientSource="TRAACS®".
6. For each study in Table 4/5/6, create one evidencePackets entry. The same study may support multiple claims — list all claim numbers in claimNos.
7. Parse dates to ISO format (YYYY-MM-DD) where possible.
8. For every emitted claim, formula line, evidence packet, and reference, include the 1-indexed PDF page number (\`sourcePage\`) where that item was observed in the PDF. If the item spans pages or the page is genuinely unknown, use null.
9. For every claim, formula line, and evidence packet: emit a confidence field. Use lower values (0.3-0.6) when source text is ambiguous, partially obscured, or could be interpreted multiple ways. Reserve 0.9+ only for clear, direct observations. Be honest — low confidence on a few items is far more useful than uniform 1.0 scores.
10. Return ONLY valid JSON — no commentary before or after.`;
}

/**
 * Commit approved extraction data to Notion databases.
 * Creates document, version, formula lines, claims, references, and revision events.
 *
 * @param {object} data - The reviewed/approved extraction data
 * @param {string|null} existingDocId - If updating an existing document, its Notion page ID
 * @returns {Promise<object>} Created entity IDs, plus `warnings[]`.
 */
export async function commitExtraction(data, existingDocId = null) {
  // Import all data layer modules
  const { createDocument, updateDocument } = await import('./pcs-documents.js');
  const { createVersion } = await import('./pcs-versions.js');
  const { createClaim } = await import('./pcs-claims.js');
  const { createFormulaLine } = await import('./pcs-formula-lines.js');
  const { createReference } = await import('./pcs-references.js');
  const { createRevisionEvent } = await import('./pcs-revision-events.js');
  const { createClaimDoseReq } = await import('./pcs-claim-dose-reqs.js');
  const { createEvidencePacket } = await import('./pcs-evidence-packets.js');
  // Multi-profile architecture (Week 1) — added 2026-04-19
  const { updateClaim } = await import('./pcs-claims.js');
  const { resolvePrefix } = await import('./pcs-prefixes.js');
  const { resolveByName: resolveBenefitCategory } = await import('./pcs-benefit-categories.js');
  const coreBenefits = await import('./pcs-core-benefits.js');
  // Canonical AI + AI Form resolvers (Phase 1) — added 2026-04-19
  const { getAllIngredients, resolveIngredientCached } = await import('./pcs-ingredients.js');
  const { getAllIngredientForms, resolveFormCached } = await import('./pcs-ingredient-forms.js');

  const warnings = [];
  const result = {
    documentId: null,
    versionId: null,
    claimIds: [],
    formulaLineIds: [],
    referenceIds: [],
    revisionEventIds: [],
    claimDoseReqIds: [],
    evidencePacketIds: [],
    warnings,
  };

  // Pre-fetch canonical AI + AI Form rows once — used to resolve formula
  // lines, claim dose requirements, and evidence-packet studyDoseAI.
  const ingredients = await getAllIngredients().catch(err => {
    warnings.push(`Failed to load Active Ingredients canonical DB: ${err?.message || err}`);
    return [];
  });
  const forms = await getAllIngredientForms().catch(err => {
    warnings.push(`Failed to load Active Ingredient Forms canonical DB: ${err?.message || err}`);
    return [];
  });

  // Phase 1: Document — build a SPARSE field map so a re-import that doesn't
  // re-extract a field doesn't wipe prior data (SKUs, demographics, etc.).
  const documentFields = {};
  const doc = data.document || {};
  if (doc.classification != null) documentFields.classification = doc.classification;
  if (doc.productStatus != null) documentFields.productStatus = doc.productStatus;
  if (doc.documentNotes != null) documentFields.documentNotes = doc.documentNotes;
  if (doc.approvedDate != null) documentFields.approvedDate = doc.approvedDate;
  if (doc.finishedGoodName != null) documentFields.finishedGoodName = doc.finishedGoodName;
  if (doc.fmt != null) documentFields.format = doc.fmt;
  if (doc.sapMaterialNo != null) documentFields.sapMaterialNo = doc.sapMaterialNo;
  if (Array.isArray(doc.skus) && doc.skus.length > 0) documentFields.skus = doc.skus;

  if (existingDocId) {
    await updateDocument(existingDocId, documentFields);
    result.documentId = existingDocId;
  } else {
    const created = await createDocument({
      pcsId: doc.pcsId,
      ...documentFields,
    });
    result.documentId = created.id;
  }

  // Phase 2: Version — required for child data
  if (!data.version?.version) {
    throw new Error(
      'Version label is required. The extracted data has no version — please add one in the review step before committing.'
    );
  }

  // Track all created page IDs for cleanup on failure
  const createdPageIds = [];
  if (!existingDocId) {
    createdPageIds.push(result.documentId);
  }

  try {
    // Sparse version field map — only include extracted values.
    const versionFields = {};
    const ver = data.version || {};
    if (ver.effectiveDate != null) versionFields.effectiveDate = ver.effectiveDate;
    if (ver.versionNotes != null) versionFields.versionNotes = ver.versionNotes;
    if (ver.productName != null) versionFields.productName = ver.productName;
    if (ver.formatOverride != null) versionFields.formatOverride = ver.formatOverride;
    // Demographic — Wave 4.1a: may be either the new axes object or the legacy flat array (backward compat).
    if (ver.demographic && typeof ver.demographic === 'object' && !Array.isArray(ver.demographic)) {
      const d = ver.demographic;
      if (Array.isArray(d.biologicalSex) && d.biologicalSex.length > 0) versionFields.biologicalSex = d.biologicalSex;
      if (Array.isArray(d.ageGroup) && d.ageGroup.length > 0) versionFields.ageGroup = d.ageGroup;
      if (Array.isArray(d.lifeStage) && d.lifeStage.length > 0) versionFields.lifeStage = d.lifeStage;
      if (Array.isArray(d.lifestyle) && d.lifestyle.length > 0) versionFields.lifestyle = d.lifestyle;
    } else if (Array.isArray(ver.demographic) && ver.demographic.length > 0) {
      // Legacy flat array — write to the legacy `demographic` property during the transition window.
      versionFields.demographic = ver.demographic;
    }
    if (ver.dailyServingSize != null) versionFields.dailyServingSize = ver.dailyServingSize;
    if (ver.totalEPA != null) versionFields.totalEPA = ver.totalEPA;
    if (ver.totalDHA != null) versionFields.totalDHA = ver.totalDHA;
    if (ver.totalEPAandDHA != null) versionFields.totalEPAandDHA = ver.totalEPAandDHA;
    if (ver.totalOmega6 != null) versionFields.totalOmega6 = ver.totalOmega6;
    if (ver.totalOmega9 != null) versionFields.totalOmega9 = ver.totalOmega9;

    const created = await createVersion({
      version: ver.version,
      pcsDocumentId: result.documentId,
      isLatest: true,
      ...versionFields,
    });
    result.versionId = created.id;
    createdPageIds.push(created.id);

    // Phase 3: Formula Lines (linked to version)
    if (data.formulaLines?.length > 0) {
      for (let idx = 0; idx < data.formulaLines.length; idx++) {
        const line = data.formulaLines[idx];
        // Lauren's template splits "Ingredient / AI form" into AI + AI Form.
        // Preserve legacy title by composing one from ai + aiForm where possible.
        const legacyTitle = line.ingredientForm
          || [line.ai, line.aiForm && `(${line.aiForm})`].filter(Boolean).join(' ')
          || 'Ingredient';

        // Resolve canonical AI + AI Form. Leave relation empty and warn if
        // missing; never fail the commit on an unknown ingredient.
        let activeIngredientCanonicalId = null;
        let activeIngredientFormCanonicalId = null;
        let resolvedIngredient = null;
        if (line.ai) {
          resolvedIngredient = resolveIngredientCached(line.ai, ingredients);
          if (resolvedIngredient) {
            activeIngredientCanonicalId = resolvedIngredient.id;
          } else {
            warnings.push(`Active ingredient not in canonical DB: "${line.ai}" on formula line ${idx + 1}`);
          }
        }
        if (line.aiForm) {
          const form = resolveFormCached(line.aiForm, activeIngredientCanonicalId, forms);
          if (form) {
            activeIngredientFormCanonicalId = form.id;
          } else {
            warnings.push(`AI form not in canonical DB for ${resolvedIngredient?.canonicalName || line.ai || 'unknown AI'}: "${line.aiForm}"`);
          }
        }

        const fl = await createFormulaLine({
          ingredientForm: legacyTitle,
          ingredientSource: line.ingredientSource,
          elementalAI: line.elementalAI, // legacy enum, may be null
          elementalAmountMg: line.elementalAmountMg, // legacy, may be null
          ratioNote: line.ratioNote,
          servingBasisNote: line.servingBasisNote,
          formulaNotes: line.formulaNotes,
          pcsVersionId: result.versionId,
          // Lauren's template Table 2 decomposition
          ai: line.ai,
          aiForm: line.aiForm,
          fmPlm: line.fmPlm,
          amountPerServing: line.amountPerServing,
          amountUnit: line.amountUnit,
          percentDailyValue: line.percentDailyValue,
          // Canonical relations (Phase 1)
          activeIngredientCanonicalId,
          activeIngredientFormCanonicalId,
          // Wave 4.5.5 — persist per-item extractor confidence (0-1). Missing → null.
          confidence: typeof line.confidence === 'number' ? line.confidence : null,
        });
        result.formulaLineIds.push(fl.id);
        createdPageIds.push(fl.id);
      }
    }

    // Phase 4: Claims (linked to version)
    // Track claimNo → claimId for evidence-packet linking in Phase 7
    const claimIdByNo = {};
    if (data.claims?.length > 0) {
      for (const claim of data.claims) {
        const cl = await createClaim({
          claim: claim.claim,
          claimNo: String(claim.claimNo),
          claimBucket: claim.claimBucket,
          claimStatus: claim.claimStatus,
          disclaimerRequired: claim.disclaimerRequired,
          claimNotes: claim.claimNotes,
          pcsVersionId: result.versionId,
          // Wave 4.5.5 — persist per-item extractor confidence (0-1). Missing → null.
          confidence: typeof claim.confidence === 'number' ? claim.confidence : null,
        });
        result.claimIds.push(cl.id);
        createdPageIds.push(cl.id);
        claimIdByNo[Number(claim.claimNo)] = cl.id;

        // Phase 4a: Multi-profile architecture (Week 1) — resolve prefix +
        // core-benefit and link to the new claim. Both are best-effort: if
        // resolution fails, the claim still commits without the link and a
        // warning is surfaced to the operator.
        let claimPrefixId = null;
        let coreBenefitId = null;
        try {
          if (claim.prefix) {
            const prefixRow = await resolvePrefix(claim.prefix);
            if (prefixRow) {
              claimPrefixId = prefixRow.id;
            } else {
              warnings.push(`Prefix not found in CAIPB: "${claim.prefix}" on claim ${claim.claimNo}`);
            }
          }
        } catch (e) {
          warnings.push(`Failed to resolve prefix "${claim.prefix}" for claim ${claim.claimNo}: ${e?.message || e}`);
        }
        try {
          if (claim.coreBenefit) {
            let benefitCategoryId = null;
            if (claim.benefitCategory) {
              const cat = await resolveBenefitCategory(claim.benefitCategory);
              if (cat) {
                benefitCategoryId = cat.id;
              } else {
                warnings.push(`Benefit category not found: "${claim.benefitCategory}" on claim ${claim.claimNo}`);
              }
            }
            const cb = await coreBenefits.resolveOrCreate(claim.coreBenefit, benefitCategoryId);
            if (cb) coreBenefitId = cb.id;
          }
        } catch (e) {
          warnings.push(`Failed to resolve core benefit "${claim.coreBenefit}" for claim ${claim.claimNo}: ${e?.message || e}`);
        }
        if (claimPrefixId || coreBenefitId) {
          await updateClaim(cl.id, { claimPrefixId, coreBenefitId });
        }

        // Phase 4b: Claim Dose Requirements for this claim
        if (claim.doseRequirements?.length > 0) {
          for (const req of claim.doseRequirements) {
            let activeIngredientCanonicalId = null;
            if (req.ai) {
              const ing = resolveIngredientCached(req.ai, ingredients);
              if (ing) {
                activeIngredientCanonicalId = ing.id;
              } else {
                warnings.push(`Active ingredient not in canonical DB for claim ${claim.claimNo} dose requirement: "${req.ai}"`);
              }
            }
            const dr = await createClaimDoseReq({
              pcsClaimId: cl.id,
              activeIngredient: req.ai,
              aiForm: req.aiForm,
              amount: req.amount,
              unit: req.unit,
              combinationGroup: req.combinationGroup ?? 1,
              activeIngredientCanonicalId,
            });
            result.claimDoseReqIds.push(dr.id);
            createdPageIds.push(dr.id);
          }
        }
      }
    }

    // Phase 5: References (linked to version)
    if (data.references?.length > 0) {
      for (const ref of data.references) {
        const r = await createReference({
          name: ref.referenceText?.substring(0, 100) || ref.label,
          pcsReferenceLabel: ref.label,
          referenceTextAsWritten: ref.referenceText,
          referenceNotes: ref.referenceNotes,
          pcsVersionId: result.versionId,
        });
        result.referenceIds.push(r.id);
        createdPageIds.push(r.id);
      }
    }

    // Phase 6: Revision History (linked to version)
    if (data.revisionHistory?.length > 0) {
      for (const evt of data.revisionHistory) {
        const re = await createRevisionEvent({
          event: evt.event,
          activityType: evt.activityType,
          responsibleDept: evt.responsibleDept,
          startDate: evt.startDate,
          endDate: evt.endDate,
          fromVersion: evt.fromVersion,
          toVersion: evt.toVersion,
          eventNotes: evt.eventNotes,
          pcsVersionId: result.versionId,
          // Lauren's template Table A dual-approval
          approverAlias: evt.approverAlias,
          approverDepartment: evt.approverDepartment,
        });
        result.revisionEventIds.push(re.id);
        createdPageIds.push(re.id);
      }
    }

    // Phase 7: Evidence Packets (Tables 4/5/6)
    // These link studies to specific claims. The evidence item itself may
    // not exist in the Evidence Library yet — commit as a packet with
    // narrative context; linking to a canonical Evidence Library entry is
    // a follow-up step the user does in the review UI.
    if (data.evidencePackets?.length > 0) {
      for (const pkt of data.evidencePackets) {
        const claimNos = Array.isArray(pkt.claimNos) ? pkt.claimNos : [];
        // Create one packet row per (claim, study) pair. Most studies
        // support one claim; multi-claim studies get a row per claim.
        for (const claimNo of claimNos) {
          const claimId = claimIdByNo[Number(claimNo)];
          if (!claimId) continue; // skip if we couldn't resolve the claim
          const ep = await createEvidencePacket({
            name: pkt.keyTakeaway?.substring(0, 80)
              || pkt.citationText?.substring(0, 80)
              || pkt.citationLabel
              || 'Evidence',
            pcsClaimId: claimId,
            // evidenceItemId intentionally null — reviewer links in UI
            substantiationTier: pkt.substantiationTier,
            studyDoseAI: pkt.studyDoseAI,
            studyDoseAmount: pkt.studyDoseAmount,
            studyDoseUnit: pkt.studyDoseUnit,
            keyTakeaway: pkt.keyTakeaway,
            studyDesignSummary: pkt.studyDesignSummary,
            sampleSize: pkt.sampleSize,
            positiveResults: pkt.positiveResults,
            neutralResults: pkt.neutralResults,
            negativeResults: pkt.negativeResults,
            potentialBiases: pkt.potentialBiases,
            nullResultRationale: pkt.nullResultRationale,
            relevanceNote: pkt.citationText, // preserve citation for later linking
            // Wave 4.5.5 — persist per-item extractor confidence (0-1). Missing → null.
            confidence: typeof pkt.confidence === 'number' ? pkt.confidence : null,
          });
          result.evidencePacketIds.push(ep.id);
          createdPageIds.push(ep.id);
        }
      }
    }
  } catch (error) {
    // Cleanup: archive all partially created records
    await archivePages(createdPageIds);
    throw error;
  }

  // Template-version classification (Wave 3.7) — best-effort; commit must not
  // fail on classifier error. Tags the PCS Document with which template it
  // matches so we can surface re-issue candidates in the batch dashboard.
  let templateVersion = null;
  let templateSignals = null;
  try {
    const { classifyTemplate } = await import('./pcs-template-classifier.js');
    const classification = classifyTemplate(data);
    templateVersion = classification.templateVersion;
    templateSignals = classification.signals;
    const signalsText = [
      `Positive (${classification.signals.positive.length}): ${classification.signals.positive.join('; ') || 'none'}`,
      `Negative (${classification.signals.negative.length}): ${classification.signals.negative.join('; ') || 'none'}`,
    ].join('\n');
    await updateDocument(result.documentId, {
      templateVersion,
      templateSignals: signalsText,
    });
  } catch (err) {
    console.warn('[CLASSIFY] Failed to classify or persist template version:', err?.message || err);
    warnings.push(`[CLASSIFY] Failed: ${err?.message || err}`);
  }

  result.templateVersion = templateVersion;
  result.templateSignals = templateSignals;

  // Research Requests generator (Wave 4.5.0) — best-effort. A failure here must
  // NEVER fail the import; the classifier above and this block follow the same
  // pattern. Individual upsert failures are swallowed inside the generator.
  try {
    const { generateValidationRequests } = await import('./pcs-request-generator.js');
    const genStats = await generateValidationRequests({
      documentId: result.documentId,
      versionId: result.versionId,
      pcsId: data.document?.pcsId,
      extraction: data,
      templateVersion,
      templateSignals,
    });
    result.requestsGenerated = genStats;
  } catch (err) {
    console.warn('[REQUEST-GEN] Failed:', err?.message || err);
    warnings.push(`[REQUEST-GEN] Failed: ${err?.message || err}`);
  }

  // Wave 5.2 — Label drift fan-out (best-effort). A freshly committed PCS
  // version may have invalidated claims/doses/demographics on its backing
  // labels. Enumerate labels and queue drift checks. Never fail the import.
  try {
    const { detectDriftForPcsDocument } = await import('./label-drift.js');
    const driftStats = await detectDriftForPcsDocument(result.documentId, {
      log: (line) => console.log('[LABEL-DRIFT]', line),
    });
    result.labelDriftStats = driftStats;
  } catch (err) {
    console.warn('[LABEL-DRIFT] Failed:', err?.message || err);
    warnings.push(`[LABEL-DRIFT] Failed: ${err?.message || err}`);
  }

  return result;
}

/**
 * Archive (soft-delete) a list of Notion pages. Used for cleanup on partial import failure.
 * Silently ignores individual archive errors to ensure best-effort cleanup.
 */
async function archivePages(pageIds) {
  if (!pageIds.length) return;
  const { Client } = await import('@notionhq/client');
  const { withRetry } = await import('./notion.js');
  const _notion = new Client({ auth: process.env.NOTION_TOKEN, timeoutMs: 30000 });

  for (const id of pageIds) {
    try {
      await withRetry(() => _notion.pages.update({ page_id: id, archived: true }));
    } catch (archiveError) {
      console.error(`Failed to archive page ${id} during cleanup:`, archiveError);
    }
  }
}
