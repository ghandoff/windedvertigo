/**
 * PubMed (NCBI Entrez) article-search provider.
 *
 * Two-stage call:
 *   1. esearch.fcgi → list of matching PMIDs
 *   2. esummary.fcgi → metadata for each PMID
 *
 * Optionally a third call to efetch.fcgi for abstracts (XML), parsed only
 * for the top N results to keep latency reasonable.
 *
 * Free, no auth required. Rate limit ~3 req/sec without API key, ~10
 * with key. We pass NCBI_API_KEY if present in env. Sleep 350ms between
 * calls when no key.
 *
 * Returns ArticleHit[] in the platform's canonical shape (see ./shape.md
 * for the schema): { id, source, title, authors, year, journal, doi,
 * pmid, abstract, openAccessPdf, url, raw }.
 */

const ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withApiKey(url) {
  const u = new URL(url);
  if (process.env.NCBI_API_KEY) u.searchParams.set('api_key', process.env.NCBI_API_KEY);
  u.searchParams.set('tool', 'nordic-research-platform');
  u.searchParams.set('email', 'garrett@windedvertigo.com');
  return u.toString();
}

export async function search({ query, limit = 10, signal }) {
  if (!query || !query.trim()) return [];

  // Stage 1: esearch
  const eu = new URL(ESEARCH);
  eu.searchParams.set('db', 'pubmed');
  eu.searchParams.set('term', query);
  eu.searchParams.set('retmode', 'json');
  eu.searchParams.set('retmax', String(Math.min(limit, 25)));
  eu.searchParams.set('sort', 'relevance');

  const esearchRes = await fetch(withApiKey(eu.toString()), { signal });
  if (!esearchRes.ok) throw new Error(`PubMed esearch ${esearchRes.status}`);
  const esearchJson = await esearchRes.json();
  const pmids = esearchJson?.esearchresult?.idlist || [];
  if (pmids.length === 0) return [];

  if (!process.env.NCBI_API_KEY) await sleep(350);

  // Stage 2: esummary (batched)
  const su = new URL(ESUMMARY);
  su.searchParams.set('db', 'pubmed');
  su.searchParams.set('id', pmids.join(','));
  su.searchParams.set('retmode', 'json');
  const sumRes = await fetch(withApiKey(su.toString()), { signal });
  if (!sumRes.ok) throw new Error(`PubMed esummary ${sumRes.status}`);
  const sumJson = await sumRes.json();

  // Stage 3 (optional): efetch for abstracts. Skipped on bulk search;
  // the detail view should fetch the abstract for a single PMID when
  // the user clicks through. Keeps the search fast.

  return pmids.map((pmid) => parseSummary(sumJson?.result?.[pmid], pmid)).filter(Boolean);
}

function parseSummary(s, pmid) {
  if (!s) return null;
  const articleids = s.articleids || [];
  const doi = articleids.find((a) => a.idtype === 'doi')?.value || null;
  const pmcid = articleids.find((a) => a.idtype === 'pmc')?.value || null;
  // Open-access PDF: PubMed Central (PMC) full-text URL when available.
  const openAccessPdf = pmcid
    ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/pdf/`
    : null;
  const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  // Year — pubdate is "YYYY MMM DD" or "YYYY MMM" or "YYYY"
  const year = (s.pubdate || '').match(/\d{4}/)?.[0] || null;
  // 2026-05-05 — PubMed publication-type classifications. NCBI tags every
  // record with one or more MeSH publication types ("Randomized Controlled
  // Trial", "Meta-Analysis", "Systematic Review", "Review", etc.). We
  // surface them so downstream code can pre-tag the EVIDENCE_TYPES taxonomy
  // (pcs-config.js) instead of defaulting every import to 'RCT'.
  const pubTypes = Array.isArray(s.pubtype) ? s.pubtype : [];
  return {
    id: `pubmed:${pmid}`,
    source: 'pubmed',
    title: s.title || '',
    authors: (s.authors || []).map((a) => a.name).slice(0, 8),
    year: year ? Number(year) : null,
    journal: s.fulljournalname || s.source || null,
    doi,
    pmid,
    abstract: null, // not in esummary; fetched on demand for detail view
    openAccessPdf,
    url,
    pubTypes,
    evidenceType: classifyEvidenceType(pubTypes),
    raw: { pmid, doi, pmcid, pubtype: pubTypes },
  };
}

/**
 * Map PubMed MeSH publication-types onto the platform's EVIDENCE_TYPES
 * vocabulary (see pcs-config.js).
 *
 * Order matters — a paper tagged BOTH "Meta-Analysis" and "Review" is
 * a meta-analysis; a paper tagged "Randomized Controlled Trial" AND
 * "Journal Article" is an RCT. We probe most-specific first.
 *
 * Anything we can't classify falls through to null (caller can default
 * or prompt the operator).
 */
function classifyEvidenceType(pubTypes) {
  if (!pubTypes?.length) return null;
  const set = new Set(pubTypes.map((t) => t.toLowerCase()));
  if (set.has('meta-analysis')) return 'Meta-analysis';
  if (set.has('systematic review')) return 'Systematic review';
  if (set.has('randomized controlled trial') || set.has('controlled clinical trial')) return 'RCT';
  if (set.has('observational study') || set.has('cohort studies') || set.has('case-control studies')) return 'Observational';
  if (set.has('review')) return 'Review';
  // "Clinical Trial" without "Randomized" → Observational tier (could be
  // open-label / non-randomized; safer than calling it an RCT).
  if (set.has('clinical trial')) return 'Observational';
  return null;
}
