/**
 * BIZ-Q1 QC scrub — pure logic layer.
 *
 * Extracted from the route handler for testability. No Supabase or Next.js
 * dependencies here. The route handler calls these functions after fetching
 * the required data.
 *
 * Rule definitions: .brain/memory/biz/auto-draft-scrub-list.md
 */

// ── Name alias map ────────────────────────────────────────────────────────────

export const NAME_ALIASES: Record<string, string> = {
  James: "Jamie Galpin",
  "James Galpin": "Jamie Galpin",
};

export const COLLECTIVE_NAMES = [
  "Garrett Jaeger",
  "Lamis Sabra",
  "Jamie Galpin",
  "Maria Altamirano Gonzalez",
  "Payton Jaeger",
];

// ── (a) Unsourced figure detection ────────────────────────────────────────────

// Matches: optional currency prefix, then digits (with commas), optional
// magnitude suffix. Uses a lookahead-free structure so the currency symbol
// is always part of the captured group.
// Three alternatives:
//   (1) currency-prefixed amounts: $20M, €500,000, USD 1.2 billion
//   (2) magnitude-only amounts without currency: 1.2 million, 500 billion
//   (3) plain integers / decimals ≥ 1000 (filtered below): 5,000 teachers
const FIGURE_PATTERN =
  /(?:[$€£¥]|USD|EUR|MXN|BRL|COP)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:million|billion|M|B))?|\b\d[\d,]*(?:\.\d+)?\s*(?:million|billion)(?:\s+dollars?|euros?)?\b|\b\d[\d,]*(?:\.\d+)?\b/gi;

const SOURCE_MARKER =
  /\[\d+\]|\(\d{4}\)|per\s+ToR|per\s+RFP|source\s*:|fn\s*\d|footnote\s*\d|\bref\b/i;

// Four-digit years in the range 1900–2099 should not be flagged.
const YEAR_PATTERN = /^(?:19|20)\d{2}$/;

export function findUnsourcedFigures(text: string): string[] {
  const hits: string[] = [];
  let match: RegExpExecArray | null;
  FIGURE_PATTERN.lastIndex = 0;
  while ((match = FIGURE_PATTERN.exec(text)) !== null) {
    const figure = match[0].trim();
    // Skip years
    const digitsOnly = figure.replace(/[^0-9]/g, "");
    if (YEAR_PATTERN.test(digitsOnly)) continue;
    // Skip plain numbers under 1000 with no currency prefix
    if (!/[$€£¥]|USD|EUR|MXN|BRL|COP|million|billion/i.test(figure)) {
      if (Number(digitsOnly) < 1000) continue;
    }
    const after = text.slice(match.index + figure.length, match.index + figure.length + 120);
    if (!SOURCE_MARKER.test(after)) {
      hits.push(figure);
    }
  }
  return [...new Set(hits)];
}

// ── (b) Unverified CV claim detection ─────────────────────────────────────────

export type CvConfidence = "verified" | "needs-review" | "draft" | "not-found";

export interface CvClaim {
  name: string;
  canonicalName: string;
  confidence: CvConfidence;
}

export function findUnverifiedCvClaims(
  text: string,
  cvMap: Map<string, "verified" | "needs-review" | "draft">,
): CvClaim[] {
  const flagged: CvClaim[] = [];

  for (const canonicalName of COLLECTIVE_NAMES) {
    const aliases = Object.entries(NAME_ALIASES)
      .filter(([, v]) => v === canonicalName)
      .map(([k]) => k);

    const namesToCheck = [canonicalName, ...aliases];

    for (const name of namesToCheck) {
      if (!text.includes(name)) continue;
      const confidence = cvMap.get(canonicalName);
      if (confidence === undefined) {
        flagged.push({ name, canonicalName, confidence: "not-found" });
      } else if (confidence !== "verified") {
        flagged.push({ name, canonicalName, confidence });
      }
      break;
    }
  }
  return flagged;
}

// ── (c) ToR mismatch detection ────────────────────────────────────────────────

export interface DeliverableSpec {
  label: string;
  pageLimit: number | null;
  wordLimit: number | null;
  requiredSections: string[];
}

export interface TorMismatch {
  field: "page_limit" | "word_limit" | "required_section";
  deliverableLabel: string;
  detail: string;
}

export function checkTorMismatches(
  text: string,
  deliverables: DeliverableSpec[],
): TorMismatch[] {
  const mismatches: TorMismatch[] = [];
  const wordCount = text.trim().split(/\s+/).length;

  for (const d of deliverables) {
    if (d.wordLimit && wordCount > d.wordLimit * 1.05) {
      mismatches.push({
        field: "word_limit",
        deliverableLabel: d.label,
        detail: `draft is ~${wordCount} words; ToR limit for "${d.label}" is ${d.wordLimit}`,
      });
    }
    if (d.pageLimit) {
      const estimatedPages = Math.ceil(wordCount / 300);
      if (estimatedPages > d.pageLimit + 1) {
        mismatches.push({
          field: "page_limit",
          deliverableLabel: d.label,
          detail: `draft is ~${estimatedPages} pages (est.); ToR limit for "${d.label}" is ${d.pageLimit}`,
        });
      }
    }
    for (const section of d.requiredSections) {
      if (!text.toLowerCase().includes(section.toLowerCase())) {
        mismatches.push({
          field: "required_section",
          deliverableLabel: d.label,
          detail: `required section "${section}" (from ToR for "${d.label}") not found in draft`,
        });
      }
    }
  }
  return mismatches;
}
