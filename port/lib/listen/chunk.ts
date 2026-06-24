/**
 * Split cleaned document text into TTS-friendly chunks.
 *
 * Each chunk is rendered by one Cartesia /tts/bytes call, then played back as a
 * sequential playlist in the mobile player (no server-side concat — ffmpeg
 * can't run on CF Workers). Chunks split on sentence boundaries so the audio
 * never breaks mid-sentence; an oversized single sentence is hard-split on words.
 *
 * Pure module — no runtime deps, trivially testable.
 */

/** Cartesia handles long inputs, but smaller chunks = faster first audio +
 *  finer-grained retry. ~1800 chars ≈ a long paragraph. */
const MAX_CHUNK_CHARS = 1800;

/** Narration rate ≈ 150 wpm ≈ 840 chars/min — used for the est. minutes badge. */
const CHARS_PER_MINUTE = 840;

/** Normalise raw extracted text: strip markdown artifacts, collapse whitespace. */
export function normaliseForSpeech(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // md images → drop
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // md links → link text
    .replace(/^[#>\s]*#{1,6}\s*/gm, "") // heading markers
    .replace(/[*_`~|]+/g, " ") // emphasis / table pipes
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text into chunks no longer than maxChars, on sentence boundaries. */
export function chunkText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  // Collapse ALL whitespace (incl. newlines) to single spaces so the TTS reads a
  // smooth flow. Cartesia renders every newline / paragraph break as a 1–2s
  // pause, and a stripped citation/footnote leaves the surrounding newlines —
  // that's the awkward "pause where something was removed". Reference-section and
  // citation removal already happened in cleanForListening (which needs the
  // newlines), so flattening them here is safe. Also tidy any orphaned space
  // before punctuation a removal may have left.
  const clean = text.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  if (!clean) return [];

  // sentence-ish units: a run ending in . ! ? (keeping the terminator), or a
  // blank-line break.
  const units = clean.match(/[^.!?\n]+[.!?]+[\])'"”’]*\s*|[^.!?\n]+\n+|[^.!?\n]+$/g) ?? [clean];

  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };

  for (const unit of units) {
    if (unit.length > maxChars) {
      // a single oversized sentence — hard-split on word boundaries
      flush();
      let buf = "";
      for (const word of unit.split(/\s+/)) {
        if (buf && (buf.length + 1 + word.length) > maxChars) {
          chunks.push(buf.trim());
          buf = word;
        } else {
          buf = buf ? `${buf} ${word}` : word;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
      continue;
    }
    if (cur && (cur.length + unit.length) > maxChars) flush();
    cur += unit;
  }
  flush();
  return chunks;
}

/** Estimated listening time in whole minutes (min 1). */
export function estimateMinutes(charCount: number): number {
  return Math.max(1, Math.round(charCount / CHARS_PER_MINUTE));
}

/** Carl's spoken intro, prepended as the first chunk. */
export function buildIntro(title: string, charCount: number): string {
  const mins = estimateMinutes(charCount);
  return `this is Carl. reading ${title}. about ${mins} ${mins === 1 ? "minute" : "minutes"}.`;
}
