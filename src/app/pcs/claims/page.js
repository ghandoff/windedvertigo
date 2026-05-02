'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import PcsTable from '@/components/pcs/PcsTable';

export default function PcsClaimsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-400">Loading...</div>}>
      <PcsClaims />
    </Suspense>
  );
}

function PcsClaims() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const bucket = searchParams.get('bucket');
  const noEvidence = searchParams.get('noEvidence');
  const versionId = searchParams.get('versionId');
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (bucket) params.set('bucket', bucket);
    if (noEvidence) params.set('noEvidence', noEvidence);
    if (versionId) params.set('versionId', versionId);
    const qs = params.toString();

    fetch(`/api/pcs/claims${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then(setClaims)
      .finally(() => setLoading(false));
  }, [bucket, noEvidence, versionId]);

  async function handleUpdate(id, field, value) {
    await fetch(`/api/pcs/claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setClaims(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  const columns = [
    { key: 'claimNo', label: '#' },
    {
      key: 'claim',
      label: 'Claim',
      render: (val, row) => (
        <Link href={`/pcs/claims/${row.id}`} className="max-w-[400px] inline-block truncate text-pacific-600 hover:underline" title={val}>
          {val}
        </Link>
      ),
    },
    {
      key: 'claimBucket',
      label: 'Bucket',
      render: (val) => {
        const colors = {
          '3A': 'bg-green-100 text-green-700',
          '3B': 'bg-yellow-100 text-yellow-700',
          '3C': 'bg-red-100 text-red-700',
        };
        return val ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[val] || 'bg-gray-100 text-gray-600'}`}>
            {val}
          </span>
        ) : '—';
      },
    },
    {
      key: 'claimStatus',
      label: 'Status',
      editable: true,
      type: 'select',
      options: ['Authorized', 'Proposed', 'Not approved', 'NA', 'Unknown'],
      render: (val) => val || '—',
    },
    {
      key: 'evidencePacketIds',
      label: 'Evidence',
      sortable: false,
      render: (val) => {
        const count = val?.length || 0;
        return count === 0
          ? <span className="text-red-500 text-xs font-medium">No evidence</span>
          : <span className="text-xs">{count} item{count > 1 ? 's' : ''}</span>;
      },
    },
    {
      key: 'disclaimerRequired',
      label: 'Disclaimer',
      render: (val) => val ? <span className="text-yellow-600">Yes</span> : '—',
    },
    {
      key: 'claimNotes',
      label: 'Notes',
      editable: true,
      render: (val) => val ? (
        <span className="truncate max-w-[150px] inline-block" title={val}>{val}</span>
      ) : '—',
    },
  ];

  const title = bucket
    ? `Claims — Bucket ${bucket}`
    : noEvidence === 'true'
    ? 'Claims — Evidence gaps'
    : 'All claims';

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
        {(bucket || noEvidence || versionId) && (
          <Link href="/pcs/claims" className="text-sm text-pacific-600 hover:underline">
            Show all
          </Link>
        )}
      </div>
      <PcsTable columns={columns} data={claims} onUpdate={handleUpdate} tableKey="claims" userId={user?.reviewerId} />
    </div>
  );
}
