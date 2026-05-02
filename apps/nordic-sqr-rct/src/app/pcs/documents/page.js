'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import PcsTable from '@/components/pcs/PcsTable';

export default function PcsDocumentsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-400">Loading...</div>}>
      <PcsDocuments />
    </Suspense>
  );
}

function PcsDocuments() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = statusFilter
      ? `/api/pcs/documents?status=${encodeURIComponent(statusFilter)}`
      : '/api/pcs/documents';
    fetch(url)
      .then(res => res.json())
      .then(setDocuments)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  async function handleUpdate(id, field, value) {
    await fetch(`/api/pcs/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setDocuments(prev =>
      prev.map(d => (d.id === id ? { ...d, [field]: value } : d))
    );
  }

  const columns = [
    {
      key: 'pcsId',
      label: 'PCS ID',
      render: (val, row) => (
        <Link href={`/pcs/documents/${row.id}`} className="text-pacific-600 hover:underline font-medium">
          {val}
        </Link>
      ),
    },
    {
      key: 'id',
      label: 'View',
      sortable: false,
      render: (_val, row) => (
        <Link
          href={`/pcs/documents/${row.id}/view`}
          className="text-pacific-600 hover:underline text-xs"
        >
          Open
        </Link>
      ),
    },
    { key: 'classification', label: 'Classification' },
    {
      key: 'fileStatus',
      label: 'File status',
      editable: true,
      type: 'select',
      options: ['Static', 'Under revision', 'Unknown'],
      render: (val) => {
        const colors = {
          Static: 'bg-green-100 text-green-700',
          'Under revision': 'bg-yellow-100 text-yellow-700',
          Unknown: 'bg-gray-100 text-gray-600',
        };
        return val ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[val] || colors.Unknown}`}>
            {val}
          </span>
        ) : '—';
      },
    },
    { key: 'productStatus', label: 'Product status' },
    { key: 'approvedDate', label: 'Approved date' },
    {
      key: 'documentNotes',
      label: 'Notes',
      editable: true,
      render: (val) => val ? (
        <span className="truncate max-w-[200px] inline-block" title={val}>{val}</span>
      ) : '—',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">PCS Documents</h1>
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
        <h1 className="text-2xl font-bold text-gray-900">
          PCS Documents
          {statusFilter && <span className="text-base font-normal text-gray-500 ml-2">({statusFilter})</span>}
        </h1>
        {statusFilter && (
          <Link href="/pcs/documents" className="text-sm text-pacific-600 hover:underline">
            Show all
          </Link>
        )}
      </div>
      <PcsTable columns={columns} data={documents} onUpdate={handleUpdate} tableKey="documents" userId={user?.reviewerId} />
    </div>
  );
}
