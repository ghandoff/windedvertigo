'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import PcsTable from '@/components/pcs/PcsTable';

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

  useEffect(() => {
    const params = new URLSearchParams();
    if (ingredient) params.set('ingredient', ingredient);
    if (type) params.set('type', type);
    if (sqrReviewed !== null) params.set('sqrReviewed', sqrReviewed);
    const qs = params.toString();

    fetch(`/api/pcs/evidence${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then(setEvidence)
      .finally(() => setLoading(false));
  }, [ingredient, type, sqrReviewed]);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => (
        <Link href={`/pcs/evidence/${row.id}`} className="max-w-[300px] inline-block truncate font-medium text-pacific-600 hover:underline" title={val}>{val}</Link>
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

  const title = ingredient
    ? `Evidence — ${ingredient}`
    : type
    ? `Evidence — ${type}`
    : sqrReviewed === 'false'
    ? 'Evidence — Unreviewed'
    : 'Evidence Library';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3">
          {(ingredient || type || sqrReviewed) && (
            <Link href="/pcs/evidence" className="text-sm text-pacific-600 hover:underline">
              Show all
            </Link>
          )}
          {/* Client check is UX hint; server is the source of truth. */}
          {hasAnyRole(user, ROLE_SETS.PCS_WRITERS) && (
            <Link
              href="/pcs/admin/imports"
              className="px-3 py-1.5 bg-pacific-600 text-white rounded-md text-sm font-medium hover:bg-pacific-700 transition-colors"
            >
              Import from EndNote
            </Link>
          )}
        </div>
      </div>
      <PcsTable columns={columns} data={evidence} tableKey="evidence" userId={user?.reviewerId} />
    </div>
  );
}
