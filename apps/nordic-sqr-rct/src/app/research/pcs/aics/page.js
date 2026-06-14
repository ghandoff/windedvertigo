'use client';

/**
 * Bundle 3 Phase 3.3 — AICS Library list page.
 *
 * Mirrors `src/app/pcs/documents/page.js` exactly in shape. AICS docs are
 * the upstream sibling of PCS docs (one AICS per active ingredient; each
 * AICS feeds many PCS docs by reference). RA owns AICS reviews.
 *
 * Cap-gated at the route level via the existing /pcs layout (RoleRoute
 * requires ['pcs','pcs-readonly','admin']). The page itself filters
 * affordances using `can()` from capabilities.js so RA + admin + super-user
 * see the "+ New AICS doc" button while researchers see read-only.
 *
 * Env-not-set graceful state: when NOTION_AICS_DOCUMENTS_DB isn't configured
 * yet, the API returns 500 with an "AICS not configured" payload; the UI
 * renders a friendly empty card rather than crashing.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';
import { DEMOGRAPHICS } from '@/lib/pcs-config';
import PcsTable from '@/components/pcs/PcsTable';

export default function AicsLibraryPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-400">Loading...</div>}>
      <AicsLibrary />
    </Suspense>
  );
}

function AicsLibrary() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const demographicFilter = searchParams.get('demographic');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (demographicFilter) params.set('demographic', demographicFilter);
    const url = params.toString() ? `/api/pcs/aics?${params}` : '/api/pcs/aics';
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      // 2026-05-04 — API returns { items, nextCursor } (pagination shape).
      // Earlier code assumed an array and crashed PcsTable when fed an
      // object. Unwrap to the items array; pagination wiring TBD.
      .then((data) => setDocuments(Array.isArray(data) ? data : (data?.items || [])))
      .catch((err) => {
        const msg = err?.message || '';
        if (msg.includes('NOTION_AICS_DOCUMENTS_DB') || msg.includes('database_id') || msg.includes('AICS')) {
          setConfigError(
            'AICS Library is on the platform roadmap (DDL + API + sidebar shipped 2026-05-03) but the Notion databases are not yet provisioned. Contact the platform admin.',
          );
        } else {
          setConfigError(`Failed to load AICS docs: ${msg}`);
        }
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  async function handleUpdate(id, field, value) {
    await fetch(`/api/pcs/aics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }

  const canCreate = can(user, 'aics.documents:create');

  function buildHref(status, demographic) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (demographic) params.set('demographic', demographic);
    const qs = params.toString();
    return qs ? `/research/pcs/aics?${qs}` : '/research/pcs/aics';
  }

  const columns = [
    {
      key: 'aicsId',
      label: 'AICS ID',
      render: (val, row) => (
        <Link href={`/research/pcs/aics/${row.id}`} className="text-pacific-600 hover:underline font-medium">
          {val || '—'}
        </Link>
      ),
    },
    { key: 'aiNameText', label: 'Active Ingredient' },
    { key: 'classification', label: 'Classification' },
    {
      key: 'demographic',
      label: 'Demographic',
      render: (val) => val ? (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {val}
        </span>
      ) : '—',
    },
    {
      key: 'raReviewStatus',
      label: 'RA review',
      editable: false,
      render: (val) => {
        const colors = {
          'Approved': 'bg-green-100 text-green-700',
          'Pending RA Review': 'bg-yellow-100 text-yellow-700',
          'Rejected': 'bg-red-100 text-red-700',
        };
        return val ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[val] || 'bg-gray-100 text-gray-600'}`}>
            {val}
          </span>
        ) : '—';
      },
    },
    { key: 'approvedDate', label: 'Approved' },
    {
      key: 'documentNotes',
      label: 'Notes',
      editable: true,
      render: (val) => (val ? <span className="truncate max-w-[240px] inline-block" title={val}>{val}</span> : '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">PCS · Library</div>
          <h1 className="text-2xl font-bold text-gray-900">
            AICS Library
            {statusFilter && <span className="text-base font-normal text-gray-500 ml-2">({statusFilter})</span>}
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Active Ingredient Claims Substantiation — the upstream substantiation files that feed
            multiple downstream PCS documents. Reviewed by RA.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusFilter && (
            <Link href="/research/pcs/aics" className="text-sm text-pacific-600 hover:underline">
              Show all
            </Link>
          )}
          {canCreate ? (
            <>
              <Link
                href="/research/pcs/aics/import"
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                Batch import
              </Link>
              <Link href="/research/pcs/aics/new" className="btn-primary text-sm">+ New AICS doc</Link>
            </>
          ) : null}
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', href: buildHref(null, demographicFilter), match: !statusFilter },
          { label: 'Pending RA Review', href: buildHref('Pending RA Review', demographicFilter), match: statusFilter === 'Pending RA Review' },
          { label: 'Approved', href: buildHref('Approved', demographicFilter), match: statusFilter === 'Approved' },
          { label: 'Archived', href: buildHref('Archived', demographicFilter), match: statusFilter === 'Archived' },
        ].map((chip) => (
          <Link
            key={chip.label}
            href={chip.href}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              chip.match
                ? 'bg-pacific-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {/* Demographic filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref(statusFilter, null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
            !demographicFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All demographics
        </Link>
        {DEMOGRAPHICS.map((demo) => (
          <Link
            key={demo}
            href={buildHref(statusFilter, demo)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              demographicFilter === demo
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {demo}
          </Link>
        ))}
      </div>

      {/* Body — loading / config-error / empty / table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      ) : configError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">AICS configuration pending</p>
              <p className="mb-2">{configError}</p>
              <p className="text-xs text-amber-800">
                Schema reference: <code className="bg-amber-100 px-1 py-0.5 rounded">db/migrations/003_aics_entity_ddl.sql</code> ·
                Onboarding runbook: <code className="bg-amber-100 px-1 py-0.5 rounded">docs/runbooks/aics-onboarding.md</code>
              </p>
            </div>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center">
          <p className="text-gray-600">
            No AICS documents
            {statusFilter ? <> with status <span className="font-medium">{statusFilter}</span></> : ' yet'}.
          </p>
          {canCreate ? (
            <Link href="/research/pcs/aics/new" className="btn-primary text-sm mt-4 inline-block">+ Create the first AICS doc</Link>
          ) : null}
        </div>
      ) : (
        <PcsTable columns={columns} data={documents} onUpdate={handleUpdate} tableKey="aics-documents" userId={user?.reviewerId} />
      )}
    </div>
  );
}
