/**
 * DOI normalization for cross-database matching.
 *
 * SQR-RCT stores DOIs as URL type (https://doi.org/10.1016/j.example)
 * PCS stores DOIs as rich_text  (10.1016/j.example, doi:10.1016/..., etc.)
 *
 * This normalizes both to bare identifiers: "10.xxxx/yyyy"
 * DOIs are case-insensitive per the DOI specification.
 */

export function normalizeDoi(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let doi = raw.trim();
  if (!doi) return null;

  // strip common URL prefixes
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  // strip "doi:" prefix
  doi = doi.replace(/^doi:\s*/i, '');
  // trim whitespace and trailing periods
  doi = doi.trim().replace(/\.$/, '');
  // lowercase for comparison
  doi = doi.toLowerCase();

  // validate — DOIs always start with 10.
  if (!doi.startsWith('10.')) return null;

  return doi;
}
