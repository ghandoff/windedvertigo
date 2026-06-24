/**
 * Clean document text for listening.
 *
 * Strips the literary mechanics that make academic / article narration
 * intolerable — inline citations, footnote markers, figure/table callouts,
 * URLs, DOIs, and trailing reference lists. This mirrors the "autoskip" feature
 * in Speechify and dedicated read-aloud tools (skip citations / brackets /
 * parentheses / footnotes).
 *
 * Levels:
 *  - "clean" (default): rule-based regex stripping. Fast, free, deterministic.
 *    Targets *citation-like* parentheticals only — meaningful asides survive.
 *  - "faithful": no stripping (team-doc review where every word matters).
 *
 * A smarter "smart" tier (an LLM reading-prep pass that handles ambiguous
 * parentheticals and reads headings naturally) can layer on top later; this
 * module stays pure so it is trivially testable and free.
 */

export type CleanLevel = "faithful" | "clean";

// numeric citations: [1]  [12, 13]  [1-3]  [12]
const NUMERIC_CITATION =
  /\s?\[\d+(?:\s*[–-]\s*\d+)?(?:\s*,\s*\d+(?:\s*[–-]\s*\d+)?)*\]/g;
// author-year: (Smith et al., 2020)  (Smith & Jones 2019; Doe, 2021)  (2020)  (ibid.)
const AUTHOR_YEAR =
  /\s?\((?:[^()]*?\b(?:19|20)\d{2}[a-z]?\b[^()]*?|ibid\.?|op\.?\s?cit\.?)\)/gi;
// figure/table/equation callouts + latin abbreviations in parens
const FIG_TABLE =
  /\s?\((?:see\s+)?(?:fig(?:ure)?|table|tbl|eq(?:uation)?|cf|e\.g|i\.e|viz)\.?[^()]*\)/gi;
// urls + dois
const URL_RE = /\s?\(?\bhttps?:\/\/\S+\b\)?/gi;
const DOI_RE = /\s?\bdoi:\s?\S+/gi;
// footnote markers: [^1]  [1]-style superscripts  unicode superscripts
const FOOTNOTE_MARK = /\[\^?\d+\]|[¹²³⁰-⁹]+/g;
// a trailing references / bibliography section
const REF_SECTION =
  /\n\s*(references|bibliography|works cited|notes|endnotes)\s*\n[\s\S]*$/i;

/** Strip listening-hostile mechanics from text. Returns cleaned text. */
export function cleanForListening(text: string, level: CleanLevel = "clean"): string {
  if (level === "faithful") return text;

  let t = text;
  t = t.replace(URL_RE, " ");
  t = t.replace(DOI_RE, " ");
  t = t.replace(NUMERIC_CITATION, "");
  t = t.replace(AUTHOR_YEAR, "");
  t = t.replace(FIG_TABLE, "");
  t = t.replace(FOOTNOTE_MARK, "");
  t = t.replace(REF_SECTION, "\n");

  // tidy up what the removals left behind
  t = t.replace(/\(\s*[;,]?\s*\)/g, ""); // emptied parens
  t = t.replace(/\s+([,.;:!?])/g, "$1"); // space before punctuation
  t = t.replace(/([,;:])\1+/g, "$1"); // doubled punctuation
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}
