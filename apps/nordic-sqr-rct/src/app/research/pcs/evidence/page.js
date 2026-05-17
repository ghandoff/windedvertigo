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

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => (
        <Link href={`/research/pcs/evidence/${row.id}`} className="max-w-[300px] inline-block truncate font-medium text-pacific-600 hover:underline" title={val}>{val}</Link>
      ),
    },
    { key: 'doi', label: 'DOI' },
    { key: 'evidenceType', label: 'Type' },
    {
      key: 'ingredient',
      label: 'Ingredients',
      sortable: false,
      render: (val) => val?.length > 0 ? (
        <span className="text-xs">{val.join(', ')}</span>
      ) : <span className="text-gray-400 text-xs">Untagged</span>,
    },
    { key: 'publicationYear', label: 'Year' },
    {
      key: 'sqrScore',
      label: 'SQR Score',
      render: (val) => val != null ? (
        <span className={`font-medium ${val >= 17 ? 'text-green-600' : val >= 11 ? 'text-yellow-600' : 'text-red-600'}`}>
          {val}
        </span>
      ) : '—',
    },
    {
      key: 'sqrReviewed',
      label: 'Reviewed',
      render: (val) => val
        ? <span className="text-green-600 text-xs font-medium">Yes</span>
        : <span className="text-gray-400 text-xs">No</span>,
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
      ) : <span className="text-gray-300 text-xs">—</span>,
    },
  ];

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
      />
    </div>
  );
}
