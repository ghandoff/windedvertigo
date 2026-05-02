'use client';

/**
 * Wave 4.5.1 — Research Requests index page.
 *
 * Mirrors /pcs/documents/page.js pattern. Filter tabs drive the
 * /api/pcs/requests?filter= endpoint. Clicking the Resolve action opens
 * the RequestDetailSideSheet (view / resolve variant).
 *
 * Also supports a legacy `status=…` / `open=true` query (preserved for
 * the Command Center links that used the pre-4.5.1 listing).
 */

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import PcsTable from '@/components/pcs/PcsTable';
import RequestDetailSideSheet from '@/components/pcs/RequestDetailSideSheet';
import RequestsMetricsCard from '@/components/pcs/RequestsMetricsCard';

const FILTERS = [
  { key: 'mine', label: 'Mine' },
  { key: 'all', label: 'All Open' },
  { key: 'aged', label: 'Aged > 14 days' },
  { key: 'critical', label: 'Critical' },
];

export default function PcsRequestsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-400">Loading…</div>}>
      <PcsRequests />
    </Suspense>
  );
}

function PcsRequests() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'mine';
  const pcsIdParam = searchParams.get('pcsId'); // passed from document cards

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('filter', filter);
    if (pcsIdParam) params.set('documentId', pcsIdParam);
    // Best-effort: reviewerId is the user's Notion reviewer page id. When a team
    // member's Notion workspace user id is wired into the Assignee field, the
    // server-side contains-filter will match. Until then, "mine" often returns empty.
    if (filter === 'mine' && user?.reviewerId) params.set('assigneeId', user.reviewerId);
    return fetch(`/api/pcs/requests?${params.toString()}`)
      .then(r => r.json())
      .then(data => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [filter, pcsIdParam, user?.reviewerId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function setFilter(next) {
    if (next === filter) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', next);
    // Wave 4.3.5 fix: `router.replace` without { scroll: false } was not
    // consistently propagating a new searchParams snapshot on same-path
    // navigations in our App Router + Turbopack setup — the filter state
    // updated visually but the `useEffect(fetchRows)` dependency didn't fire.
    // Using push + scroll:false guarantees a client-side navigation event
    // that re-renders consumers of useSearchParams().
    router.push(`/pcs/requests?${params.toString()}`, { scroll: false });
  }

  function handleResolved(updated) {
    setRows(prev => prev.map(r => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  const columns = [
    {
      key: 'relatedPcsId',
      label: 'PCS',
      sortable: false,
      render: (val) => val ? (
        <Link
          href={`/pcs/documents/${val}`}
          onClick={e => e.stopPropagation()}
          className="text-pacific-600 hover:underline font-mono text-xs"
        >
          {val.slice(0, 8)}
        </Link>
      ) : '—',
    },
    {
      key: 'requestType',
      label: 'Type',
      render: (val) => val ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
          <span aria-hidden="true">
            {val === 'template-drift' ? '🔧' : val === 'low-confidence' ? '🔍' : val === 'label-drift' ? '🏷️' : '•'}
          </span>
          {val}
        </span>
      ) : '—',
    },
    {
      key: 'specificField',
      label: 'Field',
      render: (val) => val ? <span className="font-mono text-xs">{val}</span> : '—',
    },
    { key: 'assignedRole', label: 'Role' },
    {
      key: 'assignees',
      label: 'Assignee',
      sortable: false,
      render: (val) => Array.isArray(val) && val.length > 0
        ? val.map(a => a.name || a.email || a.id).join(', ')
        : <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (val) => {
        if (!val) return '—';
        const cls = val === 'Safety' ? 'bg-red-100 text-red-700'
          : val === 'High' ? 'bg-orange-100 text-orange-700'
          : 'bg-gray-100 text-gray-600';
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{val}</span>;
      },
    },
    { key: 'openedDate', label: 'Opened' },
    {
      key: 'ageDays',
      label: 'Age',
      render: (val) => typeof val === 'number' ? `${val}d` : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        if (!val) return '—';
        const cls = val === 'Done' ? 'bg-green-100 text-green-700'
          : val === 'Blocked' ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700';
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{val}</span>;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_val, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedId(row.id); }}
          className="text-xs text-pacific-600 hover:underline"
        >
          View / Resolve
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Research Requests</h1>
        {pcsIdParam && (
          <Link href="/pcs/requests" className="text-sm text-pacific-600 hover:underline">
            Clear PCS filter
          </Link>
        )}
      </div>

      <RequestsMetricsCard />

      <div className="flex items-center gap-1 border-b border-gray-200">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f.key
                ? 'border-pacific-600 text-pacific-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      ) : (
        <>
          {filter === 'mine' && !user?.reviewerId && (
            <p className="text-xs text-gray-500 italic">
              Sign in to see your assigned requests.
            </p>
          )}
          <PcsTable
            columns={columns}
            data={rows}
            emptyMessage={
              filter === 'mine' ? 'No requests assigned to you.'
                : filter === 'aged' ? 'No requests older than 14 days.'
                : filter === 'critical' ? 'No Safety or High priority requests.'
                : 'No open requests.'
            }
            tableKey="requests"
            userId={user?.reviewerId}
          />
        </>
      )}

      {selectedId && (
        <RequestDetailSideSheet
          requestId={selectedId}
          onClose={() => setSelectedId(null)}
          user={user}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
