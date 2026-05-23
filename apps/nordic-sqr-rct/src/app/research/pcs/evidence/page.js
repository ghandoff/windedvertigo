'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import PcsTable from '@/components/pcs/PcsTable';
import ArticleSearchPanel from '@/components/pcs/ArticleSearchPanel';

export default function PcsEvidencePage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-400">Loading...</div>}>
      <PcsEvidence />
    </Suspense>
  );
}

function PcsEvidence() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ingredient = searchParams.get('ingredient');
  const type = searchParams.get('type');
  const sqrReviewed = searchParams.get('sqrReviewed');
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (ingredient) params.set('ingredient', ingredient);
    if (type) params.set('type', type);
    if (sqrReviewed !== null) params.set('sqrReviewed', sqrReviewed);
    const qs = params.toString();

    fetch(`/api/pcs/evidence${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      // 2026-05-05 — defensively unwrap. If the API errors (returns
      // {error: '…'}) or starts paginating ({items, nextCursor}) the
      // PcsTable below would crash on data.filter. Always coerce to array.
      .then((data) => setEvidence(Array.isArray(data) ? data : (data?.items || [])))
      .finally(() => setLoading(false));
  }, [ingredient, type, sqrReviewed]);

  // 2026-05-17 — Column redesign:
  //   • DOI: replaced full string with a clickable link-icon presence check.
  //     The full DOI is surfaced in the row expansion panel instead.
  //   • Ingredients: first 2 shown as chips, overflow as "+N more" badge.
  //   • sqrReviewed removed — the SQR score itself communicates review status;
  //     a separate "Reviewed: Yes/No" column is redundant.
  //   • Rows are expandable (chevron + click anywhere) showing full citation,
  //     DOI/PMID links, and canonical summary.
  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => (
        <Link
          href={`/research/pcs/evidence/${row.id}`}
          className="max-w-[300px] inline-block truncate font-medium text-pacific-600 hover:underline"
          title={val}
          onClick={e => e.stopPropagation()}
        >
          {val}
        </Link>
      ),
    },
    {
      key: 'doi',
      label: 'DOI',
      sortable: false,
      render: (val) => val ? (
        <a
          href={`https://doi.org/${val}`}
          target="_blank"
          rel="noopener noreferrer"
          title={val}
          className="inline-flex items-center text-pacific-500 hover:text-pacific-700"
          onClick={e => e.stopPropagation()}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </a>
      ) : <span className="text-gray-200">—</span>,
    },
    { key: 'evidenceType', label: 'Type' },
    {
      key: 'ingredient',
      label: 'Ingredients',
      sortable: false,
      render: (val) => {
        if (!val?.length) return <span className="text-gray-300 text-xs">—</span>;
        const shown = val.slice(0, 2);
        const extra = val.length - shown.length;
        return (
          <div className="flex flex-wrap gap-1">
            {shown.map(ing => (
              <span key={ing} className="inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">{ing}</span>
            ))}
            {extra > 0 && (
              <span className="inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500" title={val.slice(2).join(', ')}>
                +{extra}
              </span>
            )}
          </div>
        );
      },
    },
    { key: 'publicationYear', label: 'Year' },
    {
      key: 'sqrScore',
      label: 'SQR',
      render: (val) => val != null ? (
        <span className={`font-semibold tabular-nums ${val >= 17 ? 'text-green-600' : val >= 11 ? 'text-yellow-600' : 'text-red-600'}`}>
          {val}
        </span>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'pdf',
      label: 'PDF',
      sortable: false,
      render: (val) => val ? (
        <a href={val} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-pacific-600 hover:underline" onClick={e => e.stopPropagation()}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          PDF
        </a>
      ) : <span className="text-gray-200 text-xs">—</span>,
    },
  ];

  // 2026-05-17 — Expansion panel content for each evidence row.
  // Shows the full citation (all authors, journal, volume, pages),
  // DOI + PMID as external links, and the canonical summary if present.
  const evidenceExpandRender = (row) => (
    <div className="py-2.5 space-y-2">
      {row.citation ? (
        <p className="text-xs text-gray-700 leading-relaxed">{row.citation}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {row.doi ? (
          <a
            href={`https://doi.org/${row.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-pacific-600 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            DOI: {row.doi}
          </a>
        ) : null}
        {row.pmid ? (
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-pacific-600 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            PMID: {row.pmid}
          </a>
        ) : null}
        {row.sqrScore != null ? (
          <span className={`font-medium ${row.sqrScore >= 17 ? 'text-green-700' : row.sqrScore >= 11 ? 'text-yellow-700' : 'text-red-700'}`}>
            SQR {row.sqrScore}{row.sqrRiskOfBias ? ` · ${row.sqrRiskOfBias} risk of bias` : ''}
          </span>
        ) : null}
        {row.ingredient?.length > 2 ? (
          <span className="text-gray-500">
            All ingredients: {row.ingredient.join(', ')}
          </span>
        ) : null}
      </div>
      {row.canonicalSummary ? (
        <p className="text-xs text-gray-500 italic leading-relaxed">{row.canonicalSummary}</p>
      ) : null}
    </div>
  );

  // 2026-05-16 — fire-and-forget analytics fetch; banner is optional so errors are silent
  useEffect(() => {
    fetch('/api/pcs/evidence/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalytics(data); })
      .catch(() => {});
  }, []);

  const title = ingredient
    ? `Evidence — ${ingredient}`
    : type
    ? `Evidence — ${type}`
    : sqrReviewed === 'false'
    ? 'Evidence — Unreviewed'
    : 'Evidence Repository';

  // 2026-05-05 — refresh the table after a successful "Add to Evidence"
  // from the article-search panel so the new row appears immediately.
  // Declared BEFORE any early return so the hook order stays stable
  // across `loading=true → false` transitions.
  const refresh = useCallback(() => {
    const params = new URLSearchParams();
    if (ingredient) params.set('ingredient', ingredient);
    if (type) params.set('type', type);
    if (sqrReviewed !== null) params.set('sqrReviewed', sqrReviewed);
    const qs = params.toString();
    fetch(`/api/pcs/evidence${qs ? `?${qs}` : ''}`)
      .then((res) => res.json())
      .then((data) => setEvidence(Array.isArray(data) ? data : (data?.items || [])));
  }, [ingredient, type, sqrReviewed]);

  // 2026-05-05 — Two-phase update so the operator sees their newly-saved
  // article in the table immediately:
  //   1. Optimistic prepend — the save-from-search response includes the
  //      created `entry`; splice it onto the front of state right away
  //      so the row is visible before Notion finishes propagating.
  //   2. Authoritative re-fetch after 4s — Notion's Database query API
  //      can take 2–5s to surface a freshly-created page, so a single
  //      synchronous refresh often misses it. Schedule a follow-up.
  const handleAttached = useCallback(
    (entry) => {
      if (entry?.id) {
        setEvidence((prev) => {
          // Avoid duplicates on the optimistic insert if the row somehow
          // already came back from a concurrent fetch.
          const exists = prev.some((e) => e.id === entry.id);
          if (exists) return prev;
          return [entry, ...prev];
        });
      }
      // Belt-and-suspenders authoritative refresh after Notion settles.
      const t = setTimeout(refresh, 4000);
      return () => clearTimeout(t);
    },
    [refresh],
  );

  const canAttach = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3">
          {(ingredient || type || sqrReviewed) && (
            <Link href="/research/pcs/evidence" className="text-sm text-pacific-600 hover:underline">
              Show all
            </Link>
          )}
          {canAttach && (
            <Link
              href="/research/pcs/admin/imports"
              className="px-3 py-1.5 bg-pacific-600 text-white rounded-md text-sm font-medium hover:bg-pacific-700 transition-colors"
            >
              Import from EndNote
            </Link>
          )}
        </div>
      </div>

      {/* Article search — Tier 1 PubMed + Semantic Scholar live;
          CORE / OSF / Google Scholar / ResearchGate roadmapped. */}
      <ArticleSearchPanel canAttach={canAttach} onAttached={handleAttached} />

      {/* Section header separates external discovery (above) from the
          local library (below). Only shown on the unfiltered view — when
          ingredient/type/sqrReviewed is active the page h1 already carries
          the filtered context (e.g. "Evidence — Unreviewed"). */}
      {!ingredient && !type && sqrReviewed === null && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Evidence Repository
            {evidence.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {evidence.length} {evidence.length === 1 ? 'article' : 'articles'}
              </span>
            )}
          </h2>
          {analytics?.totalRetrieved > 0 && (
            <span className="text-xs text-gray-500">
              <span className="font-medium text-emerald-600">{analytics.totalRetrieved} PDFs</span>
              {' '}auto-retrieved · est.{' '}
              <span className="font-medium text-emerald-600">
                ${analytics.totalSavingsUsd.toLocaleString()} saved
              </span>
              {' '}vs. publisher prices
            </span>
          )}
        </div>
      )}

      <PcsTable
        columns={columns}
        data={evidence}
        tableKey="evidence"
        userId={user?.reviewerId}
        defaultSortKey="lastEditedTime"
        defaultSortDir="desc"
        filterPlaceholder="Search evidence library…"
        filterLabel="Search evidence library"
        expandRender={evidenceExpandRender}
        stickyFirstCol
      />
    </div>
  );
}
