/**
 * Product Label extraction via Claude Vision (Wave 5.1 — added 2026-04-21).
 *
 * Given an image buffer (PNG/JPEG/WEBP/GIF) of a supplement product label,
 * returns a structured JSON object describing the label contents along with
 * per-field and overall confidence scores.
 *
 * See docs/plans/wave-5-product-labels.md §6 for prompt design rationale and
 * the confidence-gating rules consumed by scripts/ingest-label-intake.mjs.
 *
 * Environment:
 *   LLM_API_KEY                — Anthropic API key (required).
 *   LABEL_EXTRACTION_MODEL     — override default model. Default: claude-sonnet-4-5.
 */

export const LABEL_EXTRACTION_PROMPT_VERSION = 'v3-pdf';

const DEFAULT_MODEL = process.env.LABEL_EXTRACTION_MODEL || 'claude-sonnet-4-5';

/** Anthropic messages API accepts up to 20 image/document blocks in a single user turn. */
const MAX_IMAGES_PER_CALL = 20;

/**
 * Anthropic request cap is ~32MB total (base64-encoded). We check the raw
 * byte total and leave headroom for base64 inflation (~33% larger) + prompt
 * overhead. 28MB raw ≈ ~37MB base64, still below the hard cap but tight; we
 * deliberately err on the safe side — labels rarely need that much.
 */
const MAX_TOTAL_INPUT_BYTES = 28 * 1024 * 1024;

/** Confidence thresholds, exported so callers & tests can reference the same numbers. */
export const CONFIDENCE_THRESHOLDS = Object.freeze({
  /** Overall extraction must clear this to auto-commit; else needs human validation. */
  overall: 0.7,
  /** Per-ingredient (active) dose confidence must clear this; else needs confirmation. */
  activeIngredientDose: 0.8,
});

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const PDF_MEDIA_TYPE = 'application/pdf';

/**
 * Infer a media type from a filename. Defaults to image/jpeg when ambiguous —
 * Claude Vision accepts mis-labeled JPEG vs PNG gracefully, but we log a warning.
 * Wave 5.1.2: recognises .pdf so callers can omit mediaType for mixed inputs.
 */
function inferMediaType(filename) {
  if (!filename) return 'image/jpeg';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return PDF_MEDIA_TYPE;
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Classify an input as 'image' | 'pdf' using mime type first, filename as
 * fallback. Throws on anything else so unsupported inputs surface clearly.
 */
function detectFileKind(mediaType, filename) {
  const mt = (mediaType || '').toLowerCase();
  if (mt === PDF_MEDIA_TYPE) return 'pdf';
  if (SUPPORTED_IMAGE_MEDIA_TYPES.has(mt)) return 'image';
  // Fallback: extension sniff.
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return 'image';
  return null;
}

const SYSTEM_PROMPT = `You are a supplement product-label extraction specialist. Given one or more images of a dietary-supplement product label (typically multiple panels: front display panel, back information panel, side panel, occasionally a peel-off sticker), extract the visible textual content into strict JSON matching the schema below. You never infer or hallucinate content that is not visibly present on the label.

Each input panel may be a rendered image (PNG/JPG/WEBP/GIF) OR a PDF file. Page 1 of a PDF is typically the front of the label; page 2 is typically the back. Extract from all pages of every PDF.

Multi-panel handling:
- Each image is labeled "Panel N of M" in the user turn. Treat all panels as different views of the SAME product label and merge fields across them.
- Claims may appear on front, back, OR side panels — read all panels, deduplicate identical or near-identical claim text (keep the most prominent copy), and tag location based on which panel it came from.
- The Supplement Facts / Nutrition Information panel is usually on the back or side — look across panels, not just the first one.
- If a field (e.g. product name, SKU, UPC) appears on multiple panels with identical values, report it once; if values conflict, follow rule 3 below.

Output schema (return exactly this shape — no extra keys, no prose before or after):
{
  "productName": string | null,
  "brandName": string | null,
  "sku": string | null,
  "upc": string | null,
  "servingSize": string | null,
  "netQuantity": string | null,
  "ingredients": [
    {
      "name": string,
      "dose": number | null,
      "doseUnit": string | null,
      "dailyValuePercent": number | null,
      "isActive": boolean
    }
  ],
  "claims": [
    {
      "text": string,
      "location": "front" | "back" | "side",
      "prominence": "primary" | "secondary"
    }
  ],
  "directions": string | null,
  "warnings": string | null,
  "demographicIndicators": string | null,
  "regulatoryFramework": string | null,
  "manufacturerInfo": string | null,
  "lotNumber": string | null,
  "expirationDate": string | null,
  "confidence": {
    "perField": { "<fieldName>": number | "unreadable" | "conflict" },
    "overall": number
  }
}

Extraction rules:
1. Only extract text that is visibly present. Do not infer, translate, or normalize beyond what the label shows.
2. Confidence is a number 0-1. For fields that are illegible/obscured, set the value to null AND set confidence.perField[field] = "unreadable".
3. If the same field appears with conflicting values across panels (e.g. front vs back), return the front-panel value in the field AND set confidence.perField[field] = "conflict". Include the alternative in confidence.perField[field + "_alt"] as a string.
4. Claims = sentences that attribute a benefit to the product or an ingredient. Include FDA/Health-Canada-style disclaimers ("This statement has not been evaluated...") as claims with prominence "secondary".
5. Ingredients = only rows inside the Supplement Facts / Nutrition Information panel. Mark isActive=true for nutritive/active ingredients; isActive=false for excipients ("Other ingredients", fillers, gelatin, glycerin, water, etc.) when present. If the label does not distinguish, default isActive=true for everything in the Supplement Facts panel.
6. For each active ingredient, confidence.perField["ingredient.<name>.dose"] must be provided as a number 0-1 — this is the gating signal for downstream validation.
7. If the regulatory framework is not explicitly stated, infer it ONLY from the presence of the FDA DSHEA disclaimer ("This statement has not been evaluated by the Food and Drug Administration..."). Otherwise set it to null.
8. "location" on claims: "front" = principal display panel; "back" = information panel; "side" = any other panel.
9. overall confidence: your honest global self-assessment of extraction fidelity, factoring image quality, glare, legibility, and missing panels.
10. Never emit markdown fences, commentary, or trailing text. Return exactly one JSON object.`;

function sanitizeFilename(name) {
  return (name || 'label').replace(/[^A-Za-z0-9._\- ]/g, '');
}

function toBuffer(bytes) {
  if (!bytes) return null;
  if (bytes instanceof Buffer) return bytes;
  return Buffer.from(bytes);
}

/**
 * Run Claude Vision against one or more label panels and return the structured extraction.
 *
 * Wave 5.1.1 (2026-04-21) — multi-image support. Labels are typically multi-panel
 * (front, back, side, sometimes a peel-off). Pass ALL available panels in one call
 * so the model can cross-reference fields (e.g. Supplement Facts usually lives on
 * the back or side, not the front display panel).
 *
 * Wave 5.1.2 (2026-04-21) — PDF support. Each input may be an image (PNG/JPEG/
 * WEBP/GIF) OR a PDF file; Anthropic accepts both `image` and `document` blocks
 * in a single message. Mime-type + extension sniff picks the right block kind.
 *
 * @param {Array<{ buffer: Buffer|Uint8Array|ArrayBuffer, mediaType?: string, filename?: string }>|Buffer|Uint8Array|ArrayBuffer} images
 *        New signature: array of input descriptors (images and/or PDFs, up to 20 per Anthropic API).
 *        Legacy signature: a raw Buffer (wrapped into a single-input array + deprecation warning).
 * @param {string|object} [context] - Optional operator hints string ("SKU 12345, US market") OR legacy `filename` string.
 * @returns {Promise<object>} Parsed extraction object (see schema above) with `promptVersion`, `model`, and `imageCount` tacked on.
 */
export async function extractLabel(images, context) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('extractLabel: LLM_API_KEY is not configured');
  }

  // ─── Backward-compat shim ────────────────────────────────────────────────
  // Legacy callers: extractLabel(buffer, filename)
  let normalized;
  let contextHint;
  if (!Array.isArray(images)) {
    if (!images) throw new Error('extractLabel: images is required (array of { buffer, mediaType, filename })');
    // Legacy single-buffer path.
    // eslint-disable-next-line no-console
    console.warn('[extractLabel] Deprecated: pass an array of { buffer, mediaType, filename } instead of (buffer, filename). Wrapping single buffer for backward compatibility.');
    normalized = [{
      buffer: images,
      filename: typeof context === 'string' ? context : undefined,
    }];
    contextHint = undefined;
  } else {
    normalized = images;
    contextHint = typeof context === 'string' ? context : null;
  }

  if (normalized.length === 0) {
    throw new Error('extractLabel: images array is empty — at least one image is required');
  }
  if (normalized.length > MAX_IMAGES_PER_CALL) {
    throw new Error(`extractLabel: received ${normalized.length} images; Anthropic API accepts up to ${MAX_IMAGES_PER_CALL} per call`);
  }

  // Validate + encode every input. Wave 5.1.2 — accept PDFs alongside images.
  let totalBytes = 0;
  const prepared = normalized.map((img, idx) => {
    const buf = toBuffer(img?.buffer);
    if (!buf || buf.length === 0) {
      throw new Error(`extractLabel: input[${idx}] has empty buffer`);
    }
    const mediaType = img?.mediaType || inferMediaType(img?.filename);
    const kind = detectFileKind(mediaType, img?.filename);
    if (!kind) {
      throw new Error(
        `extractLabel: input[${idx}] unsupported media type ${mediaType} ` +
        `(supported images: ${[...SUPPORTED_IMAGE_MEDIA_TYPES].join(', ')}; supported documents: ${PDF_MEDIA_TYPE})`
      );
    }
    totalBytes += buf.length;
    return {
      kind,
      mediaType: kind === 'pdf' ? PDF_MEDIA_TYPE : mediaType,
      data: buf.toString('base64'),
      filename: sanitizeFilename(img?.filename),
    };
  });

  if (totalBytes > MAX_TOTAL_INPUT_BYTES) {
    const mb = (totalBytes / 1024 / 1024).toFixed(1);
    const capMb = (MAX_TOTAL_INPUT_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(
      `extractLabel: label files total ${mb} MB — reduce file size or split across fewer panels (cap: ${capMb} MB).`
    );
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const total = prepared.length;
  // Interleave an image/document block then a small "Panel N of M" text label
  // so the model knows which input maps to which panel identifier.
  const content = [];
  prepared.forEach((img, i) => {
    if (img.kind === 'pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: PDF_MEDIA_TYPE,
          data: img.data,
        },
      });
    } else {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.data,
        },
      });
    }
    content.push({
      type: 'text',
      text: `Panel ${i + 1} of ${total} (${img.kind === 'pdf' ? 'PDF' : 'image'}, filename: "${img.filename}")`,
    });
  });

  const trailer = [
    `Extract the supplement label across all ${total} panel${total === 1 ? '' : 's'} above.`,
    'Merge fields across panels per the multi-panel rules in your system prompt.',
    contextHint ? `Operator hints: ${contextHint}` : null,
    'Return exactly one JSON object matching the schema in your system prompt.',
  ].filter(Boolean).join(' ');
  content.push({ type: 'text', text: trailer });

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  const text = message?.content?.[0]?.text || '';
  const parsed = parseExtractionJSON(text, message?.stop_reason);
  parsed.promptVersion = LABEL_EXTRACTION_PROMPT_VERSION;
  parsed.model = DEFAULT_MODEL;
  parsed.imageCount = total;
  return parsed;
}

/**
 * Check whether an extraction passes the confidence gates.
 * Exported so the intake script & future drift runners share the same policy.
 *
 * @param {object} extraction - Parsed output from extractLabel().
 * @returns {{ passes: boolean, reasons: string[], lowDoseIngredients: string[] }}
 */
export function evaluateConfidenceGates(extraction) {
  const reasons = [];
  const lowDoseIngredients = [];
  const overall = Number(extraction?.confidence?.overall);
  if (!Number.isFinite(overall) || overall < CONFIDENCE_THRESHOLDS.overall) {
    reasons.push(`overall confidence ${Number.isFinite(overall) ? overall.toFixed(2) : 'missing'} < ${CONFIDENCE_THRESHOLDS.overall}`);
  }
  const perField = extraction?.confidence?.perField || {};
  const ingredients = Array.isArray(extraction?.ingredients) ? extraction.ingredients : [];
  for (const ing of ingredients) {
    if (!ing?.isActive) continue;
    const key = `ingredient.${ing.name}.dose`;
    const raw = perField[key];
    const score = typeof raw === 'number' ? raw : NaN;
    if (!Number.isFinite(score) || score < CONFIDENCE_THRESHOLDS.activeIngredientDose) {
      lowDoseIngredients.push(ing.name);
      reasons.push(`active ingredient "${ing.name}" dose confidence ${Number.isFinite(score) ? score.toFixed(2) : 'missing'} < ${CONFIDENCE_THRESHOLDS.activeIngredientDose}`);
    }
  }
  return { passes: reasons.length === 0, reasons, lowDoseIngredients };
}

function parseExtractionJSON(text, stopReason) {
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
    const preview = text.length > 1000 ? text.slice(0, 600) + '\n…[truncated]…\n' + text.slice(-300) : text;
    throw new Error(
      `extractLabel: failed to parse JSON from Claude Vision response (stop_reason=${stopReason || 'unknown'}, ${text.length} chars). Raw:\n${preview}`
    );
  }
}
