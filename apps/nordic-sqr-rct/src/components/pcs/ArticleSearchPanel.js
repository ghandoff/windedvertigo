'use client';

/**
 * 2026-05-05 — Article search panel on /pcs/evidence.
 *
 * Operator pastes a title or DOI; the platform queries Tier-1 article
 * repositories in parallel (PubMed + Semantic Scholar today; CORE / OSF /
 * Google Scholar / ResearchGate roadmapped). Results show de-duplicated
 * hits with a `sources` chip-list (a paper found by both PubMed and
 * Semantic Scholar is more trustworthy than one found by only one).
 *
 * Each result has a one-click "Add to Evidence" button that POSTs the
 * metadata to /api/pcs/evidence — same endpoint the EndNote import uses,
 * so the resulting Notion row plays nice with downstream PCS / SQR-RCT
 * surfaces. PDF auto-fetch (download to Vercel Blob, attach to Notion)
 * is roadmapped — for now the row gets the openAccessPdf URL when the
 * provider returns one.
 */

import { useState } from 'react';
import { useToast } from '@/components/Toast';

const PROVIDER_LABELS = {
  pubmed: { label: 'PubMed', color: 'bg-pacific-100 text-pacific-800' },
  'semantic-scholar': { label: 'Semantic Scholar', color: 'bg-purple-100 text-purple-800' },
  core: { label: 'CORE', color: 'bg-amber-100 text-amber-800' },
  osf: { label: 'OSF', color: 'bg-green-100 text-green-800' },
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
      const payload = {
        name: hit.title,
        doi: hit.doi || undefined,
        pmid: hit.pmid || undefined,
        url: hit.url || undefined,
        publicationYear: hit.year || undefined,
        // 2026-05-05 — Auto-classify from PubMed MeSH publication types
        // (see pubmed provider's classifyEvidenceType). Falls back to RCT
        // only when no provider classified it; the operator can still
        // refine on the row's detail page.
        evidenceType: hit.evidenceType || 'RCT',
        pdf: hit.openAccessPdf || undefined,
        canonicalSummary: hit.abstract ? hit.abstract.slice(0, 1900) : undefined,
      };
      const res = await fetch('/api/pcs/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setAttached((s) => ({ ...s, [hit.id]: { ok: true, id: body.id } }));
      toast?.success?.(`Added "${hit.title.slice(0, 60)}…" to Evidence Library`);
      if (onAttached) onAttached(body);
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
          <h2 className="text-sm font-semibold text-gray-900">Find research articles</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
            Paste a title, DOI, or PMID. We&apos;ll query PubMed and Semantic Scholar in parallel,
            de-duplicate the hits, and show which sources confirmed each result.{' '}
            <span className="text-gray-400 italic">CORE, OSF / pre-registration, Google Scholar, and ResearchGate are on the roadmap.</span>
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
                <div className="shrink-0 self-center">
                  {a?.ok ? (
                    <span className="text-xs text-green-700 font-medium">✓ Added</span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAttach || !!attaching[h.id]}
                      onClick={() => onAttach(h)}
                      className="whitespace-nowrap rounded-md border border-pacific-600 bg-white px-3 py-1.5 text-xs font-medium text-pacific-700 hover:bg-pacific-50 disabled:opacity-40"
                      title={!canAttach ? 'Requires pcs.evidence:attach capability' : 'Create a Notion Evidence row from this hit'}
                    >
                      {attaching[h.id] ? 'Adding…' : '+ Add to Evidence'}
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
