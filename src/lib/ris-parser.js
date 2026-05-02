/**
 * Client-side RIS file parser for importing references from EndNote exports.
 *
 * RIS format: each line is "XX  - value" (two-letter tag, two spaces, dash, space, value).
 * Records are delimited by "ER  -".
 * Multi-value tags (AU, A1, KW) appear as repeated lines and are collected into arrays.
 * Continuation lines (lines that don't match the tag pattern) belong to the previous tag.
 *
 * Returns an array of ParsedReference objects ready for the evidence import UI.
 */

// Known ingredient patterns — matched against KW tags (case-insensitive)
const INGREDIENT_PATTERNS = [
  { name: 'Omega-3 (general)', keywords: ['omega-3', 'omega 3', 'fish oil', 'n-3 fatty acid', 'n-3 pufa'] },
  { name: 'EPA', keywords: ['epa', 'eicosapentaenoic'] },
  { name: 'DHA', keywords: ['dha', 'docosahexaenoic'] },
  { name: 'Vitamin D', keywords: ['vitamin d', 'cholecalciferol', '25-hydroxyvitamin', '25(oh)d'] },
  { name: 'Probiotics', keywords: ['probiotic', 'lactobacillus', 'bifidobacterium', 'saccharomyces'] },
  { name: 'CoQ10', keywords: ['coq10', 'coenzyme q10', 'ubiquinone', 'ubiquinol'] },
  { name: 'Curcumin', keywords: ['curcumin', 'turmeric', 'curcuma'] },
  { name: 'Magnesium', keywords: ['magnesium'] },
  { name: 'Vitamin K2', keywords: ['vitamin k2', 'menaquinone', 'mk-7', 'mk-4'] },
];

// Multi-value tags that produce arrays (one value per line)
const MULTI_VALUE_TAGS = new Set(['AU', 'A1', 'KW']);

// RIS type -> evidenceType mapping
const TYPE_MAP = {
  JOUR: 'RCT',
  RPRT: 'Review',
  THES: 'Other',
  BOOK: 'Other',
  CHAP: 'Other',
  CONF: 'Other',
  MGZN: 'Review',
};

// Regex for RIS tag lines: two-letter alphanumeric tag, two spaces, dash, space, value
const TAG_LINE_RE = /^([A-Z][A-Z0-9])\s\s-\s(.*)$/;

/**
 * Parse an RIS file into an array of evidence-ready reference objects.
 *
 * @param {string} text - The raw RIS file content
 * @param {string|null} [endnoteGroup=null] - Group label to apply to all parsed references
 * @returns {ParsedReference[]}
 */
export function parseRIS(text, endnoteGroup = null) {
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Normalize line endings to \n
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const rawRecords = [];
  let current = {};
  let lastTag = null;

  for (const line of lines) {
    const match = line.match(TAG_LINE_RE);

    if (match) {
      const [, tag, value] = match;
      const trimmed = value.trim();

      if (tag === 'ER') {
        // End of record
        if (current.TI || current.T1) {
          rawRecords.push(current);
        }
        current = {};
        lastTag = null;
        continue;
      }

      if (MULTI_VALUE_TAGS.has(tag)) {
        if (!current[tag]) current[tag] = [];
        current[tag].push(trimmed);
      } else if (current[tag] !== undefined) {
        // Tag already set — for single-value tags keep first occurrence
        // (except we append for multi-line continuation via lastTag below)
      } else {
        current[tag] = trimmed;
      }
      lastTag = tag;
    } else if (lastTag && line.trim()) {
      // Continuation line — append to previous tag's value
      if (MULTI_VALUE_TAGS.has(lastTag)) {
        const arr = current[lastTag];
        if (arr && arr.length > 0) {
          arr[arr.length - 1] += ' ' + line.trim();
        }
      } else {
        current[lastTag] = (current[lastTag] || '') + ' ' + line.trim();
      }
    }
  }

  // Handle file without final ER tag
  if (current.TI || current.T1) {
    rawRecords.push(current);
  }

  return rawRecords.map(raw => buildReference(raw, endnoteGroup));
}

/**
 * Transform a raw RIS record into a ParsedReference.
 */
function buildReference(raw, endnoteGroup) {
  const title = (raw.TI || raw.T1 || '').substring(0, 2000);
  const authors = raw.AU || raw.A1 || [];
  const journal = raw.JO || raw.JF || raw.T2 || null;
  const yearRaw = raw.PY || raw.Y1 || '';
  const yearMatch = yearRaw.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
  const volume = raw.VL || null;
  const issue = raw.IS || null;
  const startPage = raw.SP || null;
  const endPage = raw.EP || null;
  const abstract = raw.AB || raw.N2 || null;

  // DOI: strip URL prefix, lowercase
  let doi = raw.DO || null;
  if (doi) {
    doi = doi.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:\s*/i, '').trim().toLowerCase();
    if (!doi) doi = null;
  }

  // URL: first URL found
  const url = raw.UR || null;

  // EndNote record ID from AN tag
  const endnoteRecordId = raw.AN || null;

  // PMID detection: check misc/notes fields
  let pmid = extractPMID(raw);

  // Map RIS type to evidence type
  const risType = raw.TY || '';
  const evidenceType = TYPE_MAP[risType] || null;

  // Detect ingredients from KW tags only
  const keywords = raw.KW || [];
  const kwText = keywords.join(' ').toLowerCase();
  const ingredient = [];
  for (const { name, keywords: kws } of INGREDIENT_PATTERNS) {
    if (kws.some(kw => kwText.includes(kw))) {
      if (!ingredient.includes(name)) {
        ingredient.push(name);
      }
    }
  }

  // Build formatted citation
  const citation = buildCitation(authors, title, journal, year, volume, issue, startPage, endPage);

  const enrichable = !!(doi || pmid);

  return {
    name: title,
    citation,
    doi,
    pmid,
    url,
    evidenceType,
    ingredient,
    publicationYear: year,
    endnoteRecordId,
    endnoteGroup: endnoteGroup || null,
    _abstract: abstract,
    _keywords: keywords,
    _type: risType || null,
    _enrichable: enrichable,
    _selected: true,
  };
}

/**
 * Try to extract a PMID from misc/notes fields.
 * Checks M1, M3, C1, N1, and any _misc fields for patterns like:
 *   "PMID: 12345678", "PMID:12345678", or a bare 6-8 digit number in M1.
 */
function extractPMID(raw) {
  // Collect text from fields that may contain PMID references
  const candidates = [raw.M1, raw.M3, raw.C1, raw.N1].filter(Boolean);
  const text = candidates.join(' ');

  // Match explicit PMID patterns: "PMID: 12345678" or "PMID:12345678"
  const match = text.match(/PMID[:\s]*(\d{6,8})/i);
  if (match) return match[1];

  // Bare 6-8 digit number in M1 field (common EndNote export for accession numbers)
  if (raw.M1 && /^\d{6,8}$/.test(raw.M1.trim())) {
    return raw.M1.trim();
  }

  return null;
}

/**
 * Build a formatted citation string.
 * Format: "LastName1, LastName2, et al. Title. Journal. Year;Vol(Issue):SP-EP."
 * If > 3 authors, use first 3 + "et al."
 */
function buildCitation(authors, title, journal, year, volume, issue, startPage, endPage) {
  const parts = [];

  // Authors
  if (authors.length > 0) {
    const displayAuthors = authors.length > 3
      ? [...authors.slice(0, 3), 'et al.']
      : authors;
    parts.push(displayAuthors.join(', '));
  }

  // Title
  if (title) {
    parts.push(title);
  }

  // Journal + bibliographic details
  let journalPart = '';
  if (journal) journalPart = journal;

  // Year;Volume(Issue):Pages
  let biblio = '';
  if (year) biblio += `${year}`;
  if (volume) {
    biblio += biblio ? `;${volume}` : `${volume}`;
    if (issue) biblio += `(${issue})`;
  }
  if (startPage) {
    biblio += biblio ? `:${startPage}` : `${startPage}`;
    if (endPage) biblio += `-${endPage}`;
  }

  if (journalPart && biblio) {
    parts.push(`${journalPart}. ${biblio}`);
  } else if (journalPart) {
    parts.push(journalPart);
  } else if (biblio) {
    parts.push(biblio);
  }

  let citation = parts.join('. ');

  // Clean up: remove double periods, trailing dangling punctuation
  citation = citation.replace(/\.{2,}/g, '.').replace(/[;:]\s*$/, '').trim();

  // Ensure it ends with a period
  if (citation && !citation.endsWith('.')) {
    citation += '.';
  }

  // Truncate to 2000 chars
  if (citation.length > 2000) {
    citation = citation.substring(0, 1997) + '...';
  }

  return citation;
}
