/**
 * Open-access PDF retrieval waterfall (ported in spirit from Nordic's pmc.js).
 * Tries each source in order; first one that returns real PDF bytes wins. Every
 * source is free + keyless (except CORE, which is skipped without a key).
 *
 * Order: the hit's own OA link → Unpaywall → OpenAlex OA → CORE → arXiv → Europe PMC.
 */

import { CONTACT_EMAIL, POLITE_UA, normalizeDoi } from "./format";

export interface RetrievalInput {
  doi?: string | null;
  oaUrl?: string | null; // the OA pdf link captured at add-time (scholar_link)
  arxivId?: string | null;
  pmid?: string | null;
}

export interface RetrievalResult {
  bytes: Uint8Array;
  source: string;
}

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB cap

// Fetch a URL and return bytes only if it's actually a PDF (magic %PDF).
async function tryFetchPdf(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
      headers: { "User-Agent": POLITE_UA, Accept: "application/pdf,*/*" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    const bytes = new Uint8Array(buf);
    // %PDF magic header (allow a few leading bytes of whitespace/BOM)
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
    if (!head.includes("%PDF")) return null;
    return bytes;
  } catch {
    return null;
  }
}

async function fromUnpaywall(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${CONTACT_EMAIL}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": POLITE_UA },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { best_oa_location?: { url_for_pdf?: string; url?: string } };
    return j.best_oa_location?.url_for_pdf ?? j.best_oa_location?.url ?? null;
  } catch {
    return null;
  }
}

async function fromOpenAlex(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=${CONTACT_EMAIL}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": POLITE_UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { best_oa_location?: { pdf_url?: string } };
    return j.best_oa_location?.pdf_url ?? null;
  } catch {
    return null;
  }
}

async function fromCore(doi: string): Promise<string | null> {
  const key = process.env.CORE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.core.ac.uk/v3/search/works", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ q: `doi:"${doi}"`, limit: 1 }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: Array<{ downloadUrl?: string }> };
    return j.results?.[0]?.downloadUrl ?? null;
  } catch {
    return null;
  }
}

async function fromEuropePmc(doi: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json&resultType=core&pageSize=1`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": POLITE_UA } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      resultList?: { result?: Array<{ fullTextUrlList?: { fullTextUrl?: Array<{ documentStyle?: string; url?: string }> } }> };
    };
    const urls = j.resultList?.result?.[0]?.fullTextUrlList?.fullTextUrl ?? [];
    return urls.find((u) => u.documentStyle === "pdf")?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a full-text URL via the same tier order, WITHOUT downloading bytes.
 * Returns the first working open-access URL + which source found it, or null.
 * Light enough to run for every search result so the UI can offer "read full
 * text" up front (the byte-download + R2 rehost still happens on save).
 */
export async function resolveFullTextUrl(
  input: RetrievalInput,
): Promise<{ url: string; source: string } | null> {
  const doi = normalizeDoi(input.doi);

  // 1. the OA link the provider already gave us
  if (input.oaUrl) return { url: input.oaUrl, source: "oa-link" };

  // 2. arXiv direct
  if (input.arxivId) {
    const id = input.arxivId.replace(/v\d+$/, "");
    return { url: `https://arxiv.org/pdf/${id}`, source: "arxiv" };
  }

  if (doi) {
    const up = await fromUnpaywall(doi);
    if (up) return { url: up, source: "unpaywall" };
    const oa = await fromOpenAlex(doi);
    if (oa) return { url: oa, source: "openalex" };
    const core = await fromCore(doi);
    if (core) return { url: core, source: "core" };
    const epmc = await fromEuropePmc(doi);
    if (epmc) return { url: epmc, source: "europepmc" };
  }

  return null;
}

/** Run the waterfall. Returns the first real PDF found, or null. */
export async function retrievePdf(input: RetrievalInput): Promise<RetrievalResult | null> {
  const doi = normalizeDoi(input.doi);

  // 1. the OA link we captured from the search hit
  if (input.oaUrl) {
    const bytes = await tryFetchPdf(input.oaUrl);
    if (bytes) return { bytes, source: "oa-link" };
  }

  // 2. arXiv direct (cheap, reliable) when we have an id
  if (input.arxivId) {
    const id = input.arxivId.replace(/v\d+$/, "");
    const bytes = await tryFetchPdf(`https://arxiv.org/pdf/${id}`);
    if (bytes) return { bytes, source: "arxiv" };
  }

  if (doi) {
    // 3. Unpaywall
    const up = await fromUnpaywall(doi);
    if (up) {
      const bytes = await tryFetchPdf(up);
      if (bytes) return { bytes, source: "unpaywall" };
    }
    // 4. OpenAlex OA location
    const oa = await fromOpenAlex(doi);
    if (oa) {
      const bytes = await tryFetchPdf(oa);
      if (bytes) return { bytes, source: "openalex" };
    }
    // 5. CORE (only if keyed)
    const core = await fromCore(doi);
    if (core) {
      const bytes = await tryFetchPdf(core);
      if (bytes) return { bytes, source: "core" };
    }
    // 6. Europe PMC (biomedical)
    const epmc = await fromEuropePmc(doi);
    if (epmc) {
      const bytes = await tryFetchPdf(epmc);
      if (bytes) return { bytes, source: "europepmc" };
    }
  }

  return null;
}
