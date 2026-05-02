/**
 * DOCX → Markdown conversion helper for the PCS import pipeline (Wave 3.8).
 *
 * Lauren authors the Nordic PCS template directly in Microsoft Word. Prior to
 * Wave 3.8 we required her (or Research) to "save as PDF" before upload,
 * which added friction AND degraded extraction quality for tables — structured
 * content comes through markedly cleaner from the native `.docx` than from a
 * re-parsed PDF.
 *
 * This helper converts a `.docx` buffer into Markdown using the pure-JS
 * `mammoth` library (no native deps, Vercel-compatible). The Markdown is then
 * fed to Claude as a text prompt by the same extractor that handles PDFs, so
 * the downstream JSON schema and prompt stay identical. Tables are preserved
 * as Markdown tables natively.
 *
 * Fails gracefully on:
 *   - Password-protected files  → DocxError.passwordProtected
 *   - Legacy binary `.doc`       → DocxError.legacyFormat
 *   - Corrupt/invalid zip        → DocxError.corrupt
 */

/**
 * Bump whenever the conversion logic (mammoth style map, warning handling,
 * table rendering) changes materially. Tracked separately from the extraction
 * `PROMPT_VERSION` so an audit can tell which side of the pipeline moved.
 */
export const DOCX_PROMPT_VERSION = 'v1-initial';

/**
 * Error taxonomy for `convertDocxToMarkdown` failures. The upload + stage
 * routes surface these distinctly in the UI so operators know whether to
 * re-save vs remove a password vs re-export from Word.
 */
export const DocxError = Object.freeze({
  passwordProtected: 'DOCX_PASSWORD_PROTECTED',
  legacyFormat:      'DOCX_LEGACY_FORMAT',
  corrupt:           'DOCX_CORRUPT',
});

/**
 * Map a mammoth/zip error to one of our DocxError tags. Returns null if the
 * error isn't one of the recognized categories.
 */
function classifyError(err) {
  const msg = (err?.message || String(err || '')).toLowerCase();
  // Mammoth errors on encrypted/password-protected OOXML packages with a
  // message like "Could not find main document part" or similar zip-level
  // decryption failure. OOXML encryption produces a "EncryptedPackage" stream
  // instead of the usual word/document.xml.
  if (msg.includes('encrypt') || msg.includes('password') || msg.includes('encryptedpackage')) {
    return DocxError.passwordProtected;
  }
  // Legacy .doc (binary Compound File Binary Format) — mammoth only handles
  // the modern .docx zip-of-XML format. JSZip fails to parse it as a zip.
  if (msg.includes('compound') || msg.includes('ole') || msg.includes('legacy') ||
      msg.includes('not a docx') || msg.includes('not a valid zip')) {
    return DocxError.legacyFormat;
  }
  // Generic zip/XML corruption.
  if (msg.includes('end of central directory') ||
      msg.includes('invalid zip') ||
      msg.includes('corrupt') ||
      msg.includes('could not find main document part')) {
    return DocxError.corrupt;
  }
  return null;
}

/**
 * Convert a `.docx` buffer to Markdown, preserving tables and surfacing
 * mammoth's own warnings (unsupported features, unknown styles, etc.).
 *
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer - Raw `.docx` bytes.
 * @returns {Promise<{
 *   markdown: string,
 *   tables: number,
 *   images: number,
 *   warnings: string[],
 *   wordCount: number,
 * }>}
 * @throws {Error} with `.code` set to one of `DocxError.*` on known failure modes.
 */
export async function convertDocxToMarkdown(buffer) {
  if (!buffer) throw new Error('convertDocxToMarkdown: buffer is required');

  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // Quick heuristic: .docx is a zip (PK magic = 0x50 0x4B). A legacy binary
  // .doc starts with D0 CF 11 E0. Catching this early gives a clean error
  // without mammoth's more cryptic zip-parse failure.
  if (buf.length < 4) {
    const e = new Error('File is empty or too small to be a valid .docx');
    e.code = DocxError.corrupt;
    throw e;
  }
  const magic = buf.subarray(0, 4);
  if (magic[0] === 0xD0 && magic[1] === 0xCF && magic[2] === 0x11 && magic[3] === 0xE0) {
    const e = new Error('Legacy binary .doc files are not supported — save as .docx and re-upload');
    e.code = DocxError.legacyFormat;
    throw e;
  }
  if (!(magic[0] === 0x50 && magic[1] === 0x4B)) {
    const e = new Error('File does not appear to be a valid .docx (missing ZIP signature)');
    e.code = DocxError.corrupt;
    throw e;
  }

  const { default: mammoth } = await import('mammoth');

  // Count embedded images independently of mammoth's conversion — we don't
  // extract them in v1, but we report the count for operator awareness.
  let imageCount = 0;
  const imageHandler = mammoth.images.imgElement(() => {
    imageCount++;
    // Return an empty element so mammoth continues without embedding a huge
    // data URL in the Markdown output. We surface the count in the result.
    return Promise.resolve({ src: '' });
  });

  let result;
  try {
    result = await mammoth.convertToMarkdown(
      { buffer: buf },
      { convertImage: imageHandler },
    );
  } catch (err) {
    const code = classifyError(err);
    if (code) {
      const e = new Error(err?.message || String(err));
      e.code = code;
      e.cause = err;
      throw e;
    }
    // Unknown error — rethrow as generic corrupt to avoid leaking mammoth internals.
    const e = new Error(`Failed to parse .docx: ${err?.message || err}`);
    e.code = DocxError.corrupt;
    e.cause = err;
    throw e;
  }

  const markdown = result?.value || '';
  const messages = Array.isArray(result?.messages) ? result.messages : [];
  const warnings = messages
    .map(m => (typeof m === 'string' ? m : (m?.message || JSON.stringify(m))))
    .filter(Boolean);

  // Count Markdown tables: a table block contains at least one row of the
  // form `| --- | --- |` (the header-separator line mammoth emits).
  const tableMatches = markdown.match(/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/gm);
  const tables = tableMatches ? tableMatches.length : 0;

  // Rough word count — split on whitespace AFTER stripping Markdown table
  // pipes and heading hashes so `| Foo | Bar |` doesn't count each cell
  // separator as a word.
  const plain = markdown
    .replace(/\|/g, ' ')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`~]/g, ' ');
  const wordCount = plain.split(/\s+/).filter(Boolean).length;

  return {
    markdown,
    tables,
    images: imageCount,
    warnings,
    wordCount,
  };
}
