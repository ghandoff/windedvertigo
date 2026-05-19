'use client';

/**
 * 2026-05-05 — Research-team article tool on /pcs/evidence.
 *
 * Two tiers chained:
 *
 *   1. DISCOVERY — operator pastes a title, DOI, PMID, or citation
 *      fragment. The platform queries article repositories in parallel
 *      (PubMed + Semantic Scholar today; OSF / Google Scholar /
 *      ResearchGate roadmapped) via /api/pcs/evidence/search and shows
 *      de-duplicated hits with a `sources` chip-list (a paper found by
 *      both providers is more trustworthy than one found by only one).
 *
 *   2. RETRIEVAL + SAVE — clicking "+ Add to Evidence" hits
 *      /api/pcs/evidence/save-from-search, which runs the SAME 6-tier
 *      PDF retrieval waterfall used by PCS imports (Unpaywall →
 *      Semantic Scholar → OpenAlex → Europe PMC → bioRxiv → PMC;
 *      see src/lib/pmc.js findAndFetchPdf), uploads the discovered
 *      PDF to Vercel Blob, and creates an Evidence Library row. The
 *      row is created orphan — not yet attached to any PCS document.
 *
 * Why this exists: researchers shouldn't have to wait until they're
 * writing a PCS document to start banking the evidence they've already
 * vetted. Populating the Evidence Library opportunistically eliminates
 * duplicated retrieval effort across the team — when a later PCS doc
 * cites an already-saved DOI/PMID, the import-time advisory dedup in
 * createEvidence (pcs-evidence.js) re-uses the existing row.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

const PROVIDER_LABELS = {
  pubmed: { label: 'PubMed', color: 'bg-pacific-100 text-pacific-800' },
  'semantic-scholar': { label: 'Semantic Scholar', color: 'bg-purple-100 text-purple-800' },
  osf: { label: 'OSF', color: 'bg-green-100 text-green-800' },
};

// 2026-05-05 — Human-readable labels for the retrieval-tier source
// names returned by src/lib/pmc.js findPdfUrl. Order here mirrors the
// waterfall order so the chip color hints at how "deep" the search had
// to go: green tiers are fast/highest-coverage, amber are mid, gray
// are last-resort fallbacks.
const PDF_SOURCE_LABEL = {
  unpaywall: 'Unpaywall',
  semantic_scholar: 'Semantic Scholar',
  openalex: 'OpenAlex',
  europe_pmc: 'Europe PMC',
  biorxiv_medrxiv: 'bioRxiv / medRxiv',
  zenodo: 'Zenodo',
  core: 'CORE',
  orcid: 'ORCID',
  pmc: 'PubMed Central',
  discovery: 'discovery search',
};

export default function ArticleSearchPanel({ canAttach, onAttached }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [attaching, setAttaching] = useState({});
  const [attached, setAttached] = useState({});

  // 2026-05-05 — When the sidebar Evidence button is clicked while we're
  // already on /pcs/evidence, Next.js Link is a no-op (same path). The
  // SidebarItem dispatches `nordic:nav-reset` so the panel can clear its
  // local state and let the operator return to the un-searched library
  // view without leaving the page first.
  useEffect(() => {
    function handler(e) {
      if (e?.detail?.href === '/pcs/evidence') {
        setQuery('');
        setHits([]);
        setProviders([]);
        setError(null);
        setSearched(false);
        setAttached({});
        setAttaching({});
      }
    }
    window.addEventListener('nordic:nav-reset', handler);
    return () => window.removeEventListener('nordic:nav-reset', handler);
  }, []);

  async function onSearch(e) {
    e?.preventDefault?.();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setHits([]);
    setProviders([]);
    try {
      const res = await fetch(`/api/pcs/evidence/search?q=${encodeURIComponent(query)}&limit=10`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setHits(body.hits || []);
      setProviders(body.providers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onAttach(hit) {
    setAttaching((s) => ({ ...s, [hit.id]: true }));
    try {
      // 2026-05-05 — Single server-side call that chains discovery →
      // 6-tier PDF retrieval waterfall (pmc.js) → Evidence row create.
      // See src/app/api/pcs/evidence/save-from-search/route.js. The
      // waterfall can take 2–15s when early tiers miss; the button
      // shows "Searching tiers…" during the call.
      const res = await fetch('/api/pcs/evidence/save-from-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hit),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setAttached((s) => ({
        ...s,
        [hit.id]: {
          ok: true,
          id: body.evidenceId,
          pdfSource: body.pdfSource,
          pdfUrl: body.pdfUrl,
          merged: body.merged === true,
          enrichedFields: body.enrichedFields || [],
        },
      }));
      const sourceLabel = body.pdfSource ? PDF_SOURCE_LABEL[body.pdfSource] || body.pdfSource : null;
      // 2026-05-05 — Wave 7.0.5 T8.1: when the server hard-merged
      // into an existing row instead of creating a new one, say so
      // explicitly. Otherwise the operator would think they created
      // a duplicate.
      const titleClip = hit.title.slice(0, 50);
      let toastMsg;
      if (body.merged) {
        const enriched = body.enrichedFields?.length > 0
          ? ` (filled: ${body.enrichedFields.join(', ')})`
          : '';
        toastMsg = `Already in library — merged${enriched}`;
      } else if (sourceLabel) {
        toastMsg = `Saved "${titleClip}…" — PDF via ${sourceLabel}`;
      } else {
        toastMsg = `Saved "${titleClip}…" — no OA PDF found`;
      }
      toast?.success?.(toastMsg);
      if (onAttached) onAttached(body.entry || body);
    } catch (err) {
      setAttached((s) => ({ ...s, [hit.id]: { ok: false, message: err.message } }));
      toast?.error?.(`Failed to add: ${err.message}`);
    } finally {
      setAttaching((s) => ({ ...s, [hit.id]: false }));
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Literature Retrieval Tool</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
            Search PubMed (NIH&apos;s 35M+ citation biomedical database) and Semantic Scholar
            (AI-powered research graph with strong preprint coverage) by title, DOI, or PMID.
            Results are de-duplicated and show which databases confirmed each article. Click{' '}
            <span className="font-medium">+ Add to Evidence</span> to automatically retrieve
            the full-text PDF across 8 open-access sources — no manual hunting, no purchase required.
          </p>
        </div>
      </div>

      <form onSubmit={onSearch} className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Three-year low-dose menaquinone-7 supplementation… or 10.1007/s00198-013-2325-6"
          className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="whitespace-nowrap rounded-md bg-pacific-600 px-4 py-2 text-sm font-medium text-white hover:bg-pacific-700 disabled:opacity-40"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Provider stats line */}
      {providers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <span>Searched:</span>
          {providers.map((p) => {
            const meta = PROVIDER_LABELS[p.id] || { label: p.id, color: 'bg-gray-100 text-gray-700' };
            return (
              <span key={p.id} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${meta.color}`}>
                {meta.label} <span className="font-mono">{p.count}{p.error ? '✗' : ''}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Search failed: {error}
        </div>
      ) : null}

      {searched && !loading && hits.length === 0 && !error ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          No hits. Try a more specific title fragment, an author + year, or paste the DOI.
        </div>
      ) : null}

      {hits.length > 0 ? (
        <ol className="divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
          {hits.map((h) => {
            const a = attached[h.id];
            return (
              <li key={h.id} className="px-3 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-sm font-semibold text-gray-900 leading-snug">{h.title}</div>
                  <div className="text-xs text-gray-600">
                    {(h.authors || []).slice(0, 4).join(', ')}
                    {(h.authors || []).length > 4 ? ' et al.' : ''}
                    {h.year ? ` · ${h.year}` : ''}
                    {h.journal ? ` · ${h.journal}` : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {h.evidenceType ? (
                      <span
                        className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-800"
                        title="Auto-classified from PubMed MeSH publication types. You can refine this on the evidence row's detail page."
                      >
                        {h.evidenceType}
                      </span>
                    ) : null}
                    {h.sources.map((s) => {
                      const meta = PROVIDER_LABELS[s] || { label: s, color: 'bg-gray-100 text-gray-700' };
                      return (
                        <span key={s} className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      );
                    })}
                    {h.doi ? (
                      <a
                        href={`https://doi.org/${h.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700 hover:bg-gray-200"
                        title="Open DOI"
                      >
                        DOI {h.doi}
                      </a>
                    ) : null}
                    {h.pmid ? (
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${h.pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700 hover:bg-gray-200"
                        title="Open in PubMed"
                      >
                        PMID {h.pmid}
                      </a>
                    ) : null}
                    {h.openAccessPdf ? (
                      <a
                        href={h.openAccessPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-green-100 px-1.5 py-0.5 font-medium text-green-800 hover:bg-green-200"
                      >
                        Open PDF ↗
                      </a>
                    ) : null}
                  </div>
                  {h.abstract ? (
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer text-pacific-600 hover:underline">Abstract</summary>
                      <p className="mt-1 leading-relaxed">{h.abstract}</p>
                    </details>
                  ) : null}
                </div>
                <div className="shrink-0 self-center flex flex-col items-end gap-1">
                  {h.existingEvidenceId && !a?.ok ? (
                    <>
                      <span className="text-xs text-emerald-700 font-medium">✓ In library</span>
                      <Link
                        href={`/pcs/evidence/${h.existingEvidenceId}`}
                        className="text-[11px] text-pacific-600 hover:underline"
                      >
                        Open existing row →
                      </Link>
                    </>
                  ) : a?.ok ? (
                    <>
                      {a.id ? (
                        <Link
                          href={`/pcs/evidence/${a.id}`}
                          className="text-xs text-green-700 font-medium hover:underline"
                          title="Open the new Evidence Library row"
                        >
                          ✓ Saved · Open row →
                        </Link>
                      ) : (
                        <span className="text-xs text-green-700 font-medium">✓ Saved</span>
                      )}
                      {a.pdfSource ? (
                        <span
                          className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
                          title={`Full-text PDF retrieved via the platform's tiered waterfall: ${PDF_SOURCE_LABEL[a.pdfSource] || a.pdfSource}`}
                        >
                          PDF · {PDF_SOURCE_LABEL[a.pdfSource] || a.pdfSource}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                          title="No open-access PDF found across the 6-tier waterfall (Unpaywall → Semantic Scholar → OpenAlex → Europe PMC → bioRxiv → PMC). Row was created with metadata only."
                        >
                          no OA PDF
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAttach || !!attaching[h.id]}
                      onClick={() => onAttach(h)}
                      className="whitespace-nowrap rounded-md border border-pacific-600 bg-white px-3 py-1.5 text-xs font-medium text-pacific-700 hover:bg-pacific-50 disabled:opacity-40"
                      title={
                        !canAttach
                          ? 'Requires pcs.evidence:attach capability'
                          : 'Save to the Evidence Library and run the 7-tier PDF retrieval waterfall (Unpaywall → Semantic Scholar → CORE → OpenAlex → Europe PMC → bioRxiv → PMC)'
                      }
                    >
                      {attaching[h.id] ? 'Searching tiers…' : '+ Add to Evidence'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
