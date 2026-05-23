/**
 * Multi-source PDF finder — 6 open-access sources in waterfall priority.
 *
 * Tries multiple open-access sources in sequence to find freely available
 * PDFs for research articles. Downloaded PDFs are uploaded to R2
 * (NORDIC_ASSETS binding) for permanent storage as Notion file references.
 * Falls back to Vercel Blob when the R2 binding is unavailable (local dev
 * without wrangler).
 *
 * Source priority (highest yield first):
 *   1. Unpaywall — indexes 30M+ OA articles (publisher, repos, preprints)
 *   2. Semantic Scholar — independent PDF discovery, good preprint coverage
 *   3. OpenAlex — aggregated OA locations across publishers + repos
 *   4. Europe PMC — broader than NCBI PMC, includes preprints + EU repos
 *   5. bioRxiv / medRxiv — preprint servers for biology + medicine
 *   6. Zenodo — CERN open repository, author-deposited post-prints + preprints
 *   7. CORE — 25M+ institutional-repository AAMs (re-added 2026-05-19)
 *   8. ORCID — author self-archived PDF links on ORCID profiles
 *   9. NCBI PMC — NIH-funded open-access articles (final fallback)
 *
 * The remaining gap after all tiers is filled by the manual PDF upload
 * path (POST /api/pcs/evidence/[id]/pdf-upload).
 */

// R2 migration complete (2026-05-07): PMC PDF storage uses Cloudflare R2 via
// `r2.put` in downloadAndUploadPdf below. The previous @vercel/blob fallback
// was removed in Phase G-2 (2026-05-23) — @vercel/blob is no longer a dependency.

const NCBI_BASE = 'https://www.ncbi.nlm.nih.gov';
const PMC_OA_BASE = `${NCBI_BASE}/pmc/utils/oa/oa.fcgi`;
const ID_CONV_BASE = `${NCBI_BASE}/pmc/utils/idconv/v1.0/`;
const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';
const SEMANTIC_SCHOLAR_BASE = 'https://api.semanticscholar.org/graph/v1/paper';
const EUROPE_PMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
const CORE_BASE = 'https://api.core.ac.uk/v3';
const OPENALEX_BASE = 'https://api.openalex.org';
const BIORXIV_BASE = 'https://api.biorxiv.org/details';
const ZENODO_BASE = 'https://zenodo.org/api/records';

// ─── ID Conversion ──────────────────────────────────────────────────

/**
 * Convert PMID or DOI to PMCID using NCBI ID Converter.
 * Returns { pmcid, pmid, doi } or null if not in PMC.
 */
export async function convertToPmcId({ pmid, doi }) {
  const ids = pmid || doi;
  if (!ids) return null;

  const url = new URL(ID_CONV_BASE);
  url.searchParams.set('ids', ids);
  url.searchParams.set('format', 'json');
  url.searchParams.set('tool', 'nordic-sqr-rct');
  url.searchParams.set('email', 'dev@nordicnaturals.com');

  const res = await fetch(url);
  if (!res.ok) return null;

  // NCBI sometimes returns XML despite format=json — guard against parse errors
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null; // XML or other non-JSON response — article not in PMC
  }

  const record = data?.records?.[0];
  if (!record || record.status === 'error' || !record.pmcid) return null;

  return {
    pmcid: record.pmcid,
    pmid: record.pmid || pmid || null,
    doi: record.doi || doi || null,
  };
}

// ─── OA PDF URL ─────────────────────────────────────────────────────

/**
 * Get the open-access PDF download URL from PMC.
 * Returns { pdfUrl, license } or null if not available.
 */
export async function getPmcPdfUrl(pmcid) {
  if (!pmcid) return null;

  const url = new URL(PMC_OA_BASE);
  url.searchParams.set('id', pmcid);
  url.searchParams.set('format', 'json');

  const res = await fetch(url);
  if (!res.ok) return null;

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  const record = data?.records?.[0];
  if (!record) return null;

  // OA service returns links for different formats — find PDF
  const pdfLink = record['link-format']
    ? record
    : null;

  // The OA API returns an href for the PDF directly
  const href = record.href || null;
  if (!href) return null;

  return {
    pdfUrl: href.startsWith('http') ? href : `https://www.ncbi.nlm.nih.gov${href}`,
    license: record.license || 'unknown',
  };
}

/**
 * Full check: PMID/DOI → PMCID → PDF URL.
 * Returns { available, pmcid, pdfUrl, license } or { available: false, reason }.
 */
export async function checkPdfAvailability({ pmid, doi }) {
  const conv = await convertToPmcId({ pmid, doi });
  if (!conv) {
    return { available: false, reason: 'Not in PMC' };
  }

  const pdf = await getPmcPdfUrl(conv.pmcid);
  if (!pdf) {
    return {
      available: false,
      pmcid: conv.pmcid,
      reason: 'In PMC but no OA PDF available',
    };
  }

  return {
    available: true,
    pmcid: conv.pmcid,
    pdfUrl: pdf.pdfUrl,
    license: pdf.license,
  };
}

// ─── Unpaywall ─────────────────────────────────────────────────────

/**
 * Check Unpaywall for an open-access PDF.
 * Free API — just requires an email identifier.
 * Covers publisher OA, institutional repos, preprint servers (bioRxiv, medRxiv).
 *
 * @returns {{ available, pdfUrl, source, host, license }} or { available: false }
 */
export async function checkUnpaywall(doi) {
  if (!doi) return { available: false, reason: 'No DOI' };

  const email = process.env.UNPAYWALL_EMAIL;
  if (!email) return { available: false, reason: 'UNPAYWALL_EMAIL not configured' };
  const url = `${UNPAYWALL_BASE}/${encodeURIComponent(doi)}?email=${email}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { available: false, reason: `Unpaywall ${res.status}` };

    const data = await res.json();

    // Try best OA location first, then fall back to any location with a PDF
    const best = data.best_oa_location;
    const pdfUrl = best?.url_for_pdf
      || data.oa_locations?.find(l => l.url_for_pdf)?.url_for_pdf;

    if (!pdfUrl) {
      return { available: false, reason: data.is_oa ? 'OA but no PDF URL' : 'Not open access' };
    }

    return {
      available: true,
      pdfUrl,
      source: 'unpaywall',
      host: best?.host_type || 'unknown',
      license: best?.license || null,
      version: best?.version || null,
    };
  } catch (err) {
    return { available: false, reason: `Unpaywall error: ${err.message}` };
  }
}

// ─── Semantic Scholar ──────────────────────────────────────────────

/**
 * Check Semantic Scholar for an open-access PDF.
 * Free API, no key needed (100 req / 5 min).
 * Good coverage of preprints, arXiv, conference papers.
 *
 * @returns {{ available, pdfUrl, source }} or { available: false }
 */
export async function checkSemanticScholar(doi) {
  if (!doi) return { available: false, reason: 'No DOI' };

  const url = `${SEMANTIC_SCHOLAR_BASE}/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf,externalIds`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { available: false, reason: `Semantic Scholar ${res.status}` };

    const data = await res.json();
    const pdfUrl = data.openAccessPdf?.url;

    if (!pdfUrl) {
      return { available: false, reason: 'No open-access PDF in Semantic Scholar' };
    }

    return {
      available: true,
      pdfUrl,
      source: 'semantic_scholar',
      s2Status: data.openAccessPdf?.status || null,
    };
  } catch (err) {
    return { available: false, reason: `Semantic Scholar error: ${err.message}` };
  }
}

// ─── Europe PMC ────────────────────────────────────────────────────

/**
 * Check Europe PMC for an open-access PDF.
 * Broader than NCBI PMC — indexes EU repositories, preprints, and
 * has its own full-text mining infrastructure.
 *
 * @returns {{ available, pdfUrl, source }} or { available: false }
 */
export async function checkEuropePmc({ doi, pmid }) {
  const query = doi
    ? `DOI:${doi}`
    : pmid
      ? `EXT_ID:${pmid} AND SRC:MED`
      : null;
  if (!query) return { available: false, reason: 'No DOI or PMID' };

  const url = `${EUROPE_PMC_BASE}/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { available: false, reason: `Europe PMC ${res.status}` };

    const data = await res.json();
    const result = data.resultList?.result?.[0];

    if (!result) {
      return { available: false, reason: 'Not found in Europe PMC' };
    }

    // Europe PMC provides fullTextUrlList with PDF links
    const pdfEntry = result.fullTextUrlList?.fullTextUrl?.find(
      u => u.documentStyle === 'pdf' && u.availabilityCode === 'OA'
    );

    if (pdfEntry?.url) {
      return {
        available: true,
        pdfUrl: pdfEntry.url,
        source: 'europe_pmc',
        pmcid: result.pmcid || null,
      };
    }

    // Fallback: if it has a PMCID, construct a direct Europe PMC PDF link
    if (result.pmcid && result.isOpenAccess === 'Y') {
      return {
        available: true,
        pdfUrl: `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${result.pmcid}&blobtype=pdf`,
        source: 'europe_pmc',
        pmcid: result.pmcid,
      };
    }

    return { available: false, reason: 'In Europe PMC but no OA PDF' };
  } catch (err) {
    return { available: false, reason: `Europe PMC error: ${err.message}` };
  }
}

// ─── CORE (Institutional Repositories) ────────────────────────────

/**
 * Check CORE for an open-access PDF.
 * CORE aggregates 25M+ documents from institutional repositories worldwide —
 * often author-accepted manuscripts deposited per funder mandates.
 * Free REST API, no key required for basic per-paper lookups.
 *
 * Response shape: { results: [{ id, doi, downloadUrl, fullTextUrl, ... }] }
 * A PDF is available when downloadUrl is non-null, or fullTextUrl ends in .pdf.
 *
 * @returns {{ available, pdfUrl, source }} or { available: false }
 */
export async function checkCore(doi) {
  if (!doi) return { available: false, reason: 'No DOI' };

  const url = `${CORE_BASE}/search/works?q=doi:"${encodeURIComponent(doi)}"&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'nordic-sqr-rct/1.0 (PDF backfill)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { available: false, reason: `CORE ${res.status}` };

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return { available: false, reason: 'Not found in CORE' };

    // Prefer downloadUrl; fall back to fullTextUrl if it points directly to a PDF
    const pdfUrl = result.downloadUrl
      || (result.fullTextUrl?.endsWith('.pdf') ? result.fullTextUrl : null);

    if (!pdfUrl) return { available: false, reason: 'No PDF URL in CORE record' };

    return { available: true, pdfUrl, source: 'core' };
  } catch (err) {
    return { available: false, reason: `CORE error: ${err.message}` };
  }
}

// ─── OpenAlex ─────────────────────────────────────────────────────

/**
 * Check OpenAlex for an open-access PDF.
 * OpenAlex indexes 250M+ works and aggregates OA locations from publishers,
 * repositories, and preprint servers. Free API, no key needed.
 *
 * @returns {{ available, pdfUrl, source }} or { available: false }
 */
export async function checkOpenAlex(doi) {
  if (!doi) return { available: false, reason: 'No DOI' };

  const url = `${OPENALEX_BASE}/works/doi:${encodeURIComponent(doi)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'nordic-sqr-rct/1.0 (mailto:dev@nordicnaturals.com)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { available: false, reason: `OpenAlex ${res.status}` };

    const data = await res.json();

    // Check all locations for a downloadable PDF URL
    const locations = data.locations || [];
    for (const loc of locations) {
      if (loc.pdf_url && loc.is_oa) {
        return {
          available: true,
          pdfUrl: loc.pdf_url,
          source: 'openalex',
          oaStatus: data.open_access?.oa_status || null,
        };
      }
    }

    // Fallback: best_oa_location
    const best = data.best_oa_location;
    if (best?.pdf_url) {
      return {
        available: true,
        pdfUrl: best.pdf_url,
        source: 'openalex',
        oaStatus: data.open_access?.oa_status || null,
      };
    }

    return { available: false, reason: data.open_access?.is_oa ? 'OA but no PDF URL in OpenAlex' : 'Not open access' };
  } catch (err) {
    return { available: false, reason: `OpenAlex error: ${err.message}` };
  }
}

// ─── bioRxiv / medRxiv ────────────────────────────────────────────

/**
 * Check bioRxiv and medRxiv for a preprint PDF.
 * These preprint servers for biology and medicine provide free PDFs.
 * API is free, no key needed.
 *
 * @returns {{ available, pdfUrl, source }} or { available: false }
 */
export async function checkBiorxiv(doi) {
  if (!doi) return { available: false, reason: 'No DOI' };

  // bioRxiv/medRxiv DOIs start with 10.1101/
  // But published articles may have a different DOI — try both servers
  for (const server of ['biorxiv', 'medrxiv']) {
    try {
      const url = `${BIORXIV_BASE}/${server}/${encodeURIComponent(doi)}/na/na/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const data = await res.json();
      const collection = data.collection || [];
      if (collection.length === 0) continue;

      const latest = collection[collection.length - 1];
      const pdfUrl = `https://www.${server}.org/content/${latest.biorxiv_doi || latest.medrxiv_doi}v${latest.version}.full.pdf`;

      return {
        available: true,
        pdfUrl,
        source: server,
        version: latest.version,
      };
    } catch {
      continue;
    }
  }

  return { available: false, reason: 'Not found in bioRxiv/medRxiv' };
}

// ─── Zenodo ───────────────────────────────────────────────────────

/**
 * Check Zenodo for an open-access PDF.
 * Zenodo (run by CERN) hosts 3M+ research outputs including author-deposited
 * post-prints, preprints, and grey literature not on bioRxiv/medRxiv.
 * Free REST API, no key required.
 *
 * @returns {{ available, pdfUrl, source }} or { available: false }
 */
export async function checkZenodo(doi) {
  if (!doi) return { available: false, reason: 'No DOI' };
  try {
    const url = `${ZENODO_BASE}?q=doi:"${encodeURIComponent(doi)}"&size=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { available: false, reason: `Zenodo ${res.status}` };
    const data = await res.json();
    const hit = data.hits?.hits?.[0];
    if (!hit) return { available: false, reason: 'Not found in Zenodo' };
    const pdfFile = hit.files?.find(f => f.type === 'pdf' || f.key?.endsWith('.pdf'));
    if (!pdfFile) return { available: false, reason: 'No PDF in Zenodo record' };
    const pdfUrl = pdfFile.links?.self
      || `https://zenodo.org/record/${hit.id}/files/${pdfFile.key}`;
    return { available: true, pdfUrl, source: 'zenodo' };
  } catch (err) {
    return { available: false, reason: `Zenodo error: ${err.message}` };
  }
}

// ─── ORCID Author Self-Archive ────────────────────────────────────

/**
 * Check ORCID profiles of article authors for a self-archived PDF URL.
 * Many researchers register papers on ORCID and include PDF or preprint links.
 * Free public API, no key required. Caps at first 3 authors to limit latency.
 *
 * @param {string} doi
 * @param {string[]} authorOrcids — ORCID IDs for the article's authors (e.g. from OpenAlex)
 * @returns {{ available, pdfUrl, source, orcid }} or { available: false }
 */
export async function checkOrcidAuthors(doi, authorOrcids = []) {
  if (!doi || authorOrcids.length === 0) {
    return { available: false, reason: 'No ORCID IDs provided' };
  }
  for (const orcid of authorOrcids.slice(0, 3)) {
    try {
      const res = await fetch(`https://pub.orcid.org/v3.0/${orcid}/works`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const group of data.group || []) {
        for (const summary of group['work-summary'] || []) {
          const extIds = summary['external-ids']?.['external-id'] || [];
          const matchesDoi = extIds.some(
            id => id['external-id-type'] === 'doi' &&
                  id['external-id-value']?.toLowerCase() === doi.toLowerCase()
          );
          if (!matchesDoi) continue;
          const url = summary?.url?.value;
          if (url && (url.endsWith('.pdf') || url.includes('/pdf/'))) {
            return { available: true, pdfUrl: url, source: 'orcid', orcid };
          }
        }
      }
    } catch { continue; }
  }
  return { available: false, reason: 'No PDF URL found via ORCID author profiles' };
}

// ─── Multi-Source Finder ───────────────────────────────────────────

/**
 * Try all sources in sequence to find an open-access PDF.
 * Returns the first successful result with source attribution.
 *
 * @param {{ doi?: string, pmid?: string, authorOrcids?: string[] }} identifiers
 * @returns {{ available, pdfUrl, source, ...metadata }} or { available: false, attempts: [] }
 */
export async function findPdfUrl({ doi, pmid, authorOrcids = [] }) {
  const attempts = [];

  // 1. Unpaywall (highest coverage for DOI-identified articles)
  if (doi) {
    const uw = await checkUnpaywall(doi);
    attempts.push({ source: 'unpaywall', ...uw });
    if (uw.available) return { ...uw, attempts };
  }

  // 2. Semantic Scholar
  if (doi) {
    const ss = await checkSemanticScholar(doi);
    attempts.push({ source: 'semantic_scholar', ...ss });
    if (ss.available) return { ...ss, attempts };
    await new Promise(r => setTimeout(r, 200)); // rate limit buffer
  }

  // 3. OpenAlex (aggregated OA locations)
  if (doi) {
    const oalex = await checkOpenAlex(doi);
    attempts.push({ source: 'openalex', ...oalex });
    if (oalex.available) return { ...oalex, attempts };
  }

  // 4. Europe PMC (broader than NCBI PMC, includes preprints + EU repos)
  const epmc = await checkEuropePmc({ doi, pmid });
  attempts.push({ source: 'europe_pmc', ...epmc });
  if (epmc.available) return { ...epmc, attempts };

  // 5. bioRxiv / medRxiv (preprint servers)
  if (doi) {
    const biorxiv = await checkBiorxiv(doi);
    attempts.push({ source: 'biorxiv_medrxiv', ...biorxiv });
    if (biorxiv.available) return { ...biorxiv, attempts };
  }

  // 6. Zenodo (CERN open repository — preprints, post-prints, author deposits)
  if (doi) {
    const zenodo = await checkZenodo(doi);
    attempts.push({ source: 'zenodo', ...zenodo });
    if (zenodo.available) return { ...zenodo, attempts };
  }

  // 7. CORE (institutional repositories — 25M+ author-accepted manuscripts)
  if (doi) {
    const core = await checkCore(doi);
    attempts.push({ source: 'core', ...core });
    if (core.available) return { ...core, attempts };
  }

  // 8. ORCID author self-archive (authors who deposited PDF links on their ORCID profile)
  if (doi && authorOrcids.length > 0) {
    const orcidResult = await checkOrcidAuthors(doi, authorOrcids);
    attempts.push({ source: 'orcid', ...orcidResult });
    if (orcidResult.available) return { ...orcidResult, attempts };
  }

  // 9. NCBI PMC (fallback)
  const pmc = await checkPdfAvailability({ doi, pmid });
  attempts.push({ source: 'pmc', available: pmc.available, reason: pmc.reason, pmcid: pmc.pmcid });
  if (pmc.available) return { available: true, pdfUrl: pmc.pdfUrl, source: 'pmc', pmcid: pmc.pmcid, license: pmc.license, attempts };

  return { available: false, attempts };
}

/**
 * End-to-end: search all sources, download PDF, upload to R2 or Blob.
 * Returns { fetched, url, size, source, ... } or { fetched: false, reason, attempts }.
 *
 * @param {{ pmid?: string, doi?: string, filename?: string, r2?: R2Bucket }} opts
 */
export async function findAndFetchPdf({ pmid, doi, filename, r2, authorOrcids = [] }) {
  const result = await findPdfUrl({ doi, pmid, authorOrcids });

  if (!result.available) {
    return {
      fetched: false,
      reason: 'No open-access PDF found across all sources',
      attempts: result.attempts,
    };
  }

  const safeName = filename || `${doi || pmid || 'unknown'}.pdf`;

  try {
    const upload = await downloadAndUploadPdf(result.pdfUrl, safeName, { r2 });
    return {
      fetched: true,
      url: upload.url,
      size: upload.size,
      source: result.source,
      pdfUrl: result.pdfUrl,
      license: result.license || null,
      pmcid: result.pmcid || null,
      attempts: result.attempts,
    };
  } catch (err) {
    // PDF URL was found but download failed — report which source and why
    return {
      fetched: false,
      reason: `Found via ${result.source} but download failed: ${err.message}`,
      pdfUrl: result.pdfUrl,
      source: result.source,
      attempts: result.attempts,
    };
  }
}

// ─── Download + Upload to R2 (or Blob fallback) ─────────────────────

const NORDIC_URL = 'https://nordic.windedvertigo.com';

/**
 * Download a PDF from a URL and upload it to R2 (preferred) or Vercel
 * Blob (fallback for local dev without a wrangler binding).
 *
 * @param {string} pdfUrl — source URL (PMC, publisher, etc.)
 * @param {string} filename — e.g. "10.1016_j.foo.2024.pdf"
 * @param {{ r2?: R2Bucket }} [opts] — pass env.NORDIC_ASSETS from a route handler
 * @returns {{ url: string, size: number }}
 */
export async function downloadAndUploadPdf(pdfUrl, filename, { r2 } = {}) {
  const res = await fetch(pdfUrl, {
    headers: { 'User-Agent': 'nordic-sqr-rct/1.0 (PDF backfill)' },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`PDF download failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());

  // Sanity check — should be a PDF
  if (!contentType.includes('pdf') && !buffer.slice(0, 5).toString().startsWith('%PDF')) {
    throw new Error(`Downloaded file is not a PDF (content-type: ${contentType})`);
  }

  // 50 MB max — generous but prevents runaway downloads
  if (buffer.length > 50 * 1024 * 1024) {
    throw new Error(`PDF too large: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `evidence-pdfs/${safeName}`;

  if (!r2) {
    throw new Error('[pmc] NORDIC_ASSETS R2 binding required (Vercel Blob fallback removed post-migration)');
  }
  await r2.put(key, buffer, {
    httpMetadata: { contentType: 'application/pdf' },
  });
  return { url: `${NORDIC_URL}/api/r2/${key}`, size: buffer.length };
}

/**
 * End-to-end: check PMC availability, download PDF, upload to R2 or Blob.
 * Returns { fetched, url, size, pmcid, license } or { fetched: false, reason }.
 *
 * @param {{ pmid?: string, doi?: string, filename?: string, r2?: R2Bucket }} opts
 */
export async function fetchAndUploadFromPmc({ pmid, doi, filename, r2 }) {
  const check = await checkPdfAvailability({ pmid, doi });
  if (!check.available) {
    return { fetched: false, reason: check.reason, pmcid: check.pmcid || null };
  }

  const safeName = filename || `${doi || pmid || 'unknown'}.pdf`;
  const upload = await downloadAndUploadPdf(check.pdfUrl, safeName, { r2 });

  return {
    fetched: true,
    url: upload.url,
    size: upload.size,
    pmcid: check.pmcid,
    license: check.license,
  };
}
