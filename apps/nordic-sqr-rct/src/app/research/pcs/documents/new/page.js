'use client';

/**
 * /research/pcs/documents/new
 *
 * Create a new blank PCS document record. The only required field is a
 * unique PCS ID (e.g. "PCS-042"). All other metadata can be filled in
 * later via the Compact inline-edit view on the document detail page.
 *
 * Posts to POST /api/pcs/documents — capability `pcs.documents:create-version`
 * is already in RESEARCHER_CAPS so no API changes are needed.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

const FILE_STATUSES = ['Static', 'Under revision', 'Unknown'];
const FORMATS = ['Softgel', 'Capsule', 'Gummy', 'Liquid', 'Powder', 'Tablet', 'Chewable', 'Other'];

export default function NewPcsDocumentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [pcsId, setPcsId] = useState('');
  const [finishedGoodName, setFinishedGoodName] = useState('');
  const [fileStatus, setFileStatus] = useState('');
  const [format, setFormat] = useState('');
  const [sapMaterialNo, setSapMaterialNo] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auth guard — writers only
  const canCreate = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-medium">You don&apos;t have permission to create PCS documents.</p>
        <Link href="/research/pcs/documents" className="mt-3 inline-block text-sm text-pacific-600 hover:underline">
          ← Back to Documents
        </Link>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedId = pcsId.trim();
    if (!trimmedId) {
      setError('PCS ID is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = { pcsId: trimmedId };
      if (finishedGoodName.trim()) payload.finishedGoodName = finishedGoodName.trim();
      if (fileStatus) payload.fileStatus = fileStatus;
      if (format) payload.format = format;
      if (sapMaterialNo.trim()) payload.sapMaterialNo = sapMaterialNo.trim();

      const res = await fetch('/api/pcs/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error || `Server error (${res.status})`);
        return;
      }

      // Navigate to the new document's detail page (Compact view for inline editing)
      router.push(`/research/pcs/documents/${body.id}`);
    } catch (err) {
      setError(err.message || 'Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Back link + header */}
      <div>
        <Link href="/research/pcs/documents" className="text-sm text-pacific-600 hover:underline">
          ← Documents
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">New PCS Document</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a blank record for a new or existing PCS. Upload and import the PDF from the document detail page after saving.
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">

        {/* PCS ID */}
        <div className="px-6 py-5">
          <label htmlFor="pcsId" className="block text-sm font-semibold text-gray-900 mb-1">
            PCS ID <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            The unique identifier from the PCS document, e.g. <span className="font-mono">PCS-042</span> or <span className="font-mono">PCS-0051</span>.
          </p>
          <input
            id="pcsId"
            type="text"
            value={pcsId}
            onChange={e => setPcsId(e.target.value)}
            placeholder="PCS-0000"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-pacific-500 focus:ring-pacific-500 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Product name */}
        <div className="px-6 py-5">
          <label htmlFor="finishedGoodName" className="block text-sm font-semibold text-gray-900 mb-1">
            Product Name
          </label>
          <p className="text-xs text-gray-500 mb-2">The finished good name as it appears on the label.</p>
          <input
            id="finishedGoodName"
            type="text"
            value={finishedGoodName}
            onChange={e => setFinishedGoodName(e.target.value)}
            placeholder="e.g. Omega-3 Fish Oil 1000mg"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-pacific-500 focus:ring-pacific-500 focus:outline-none"
          />
        </div>

        {/* Format */}
        <div className="px-6 py-5">
          <label htmlFor="format" className="block text-sm font-semibold text-gray-900 mb-1">
            Format
          </label>
          <select
            id="format"
            value={format}
            onChange={e => setFormat(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-pacific-500 focus:ring-pacific-500 focus:outline-none"
          >
            <option value="">— select —</option>
            {FORMATS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* File status */}
        <div className="px-6 py-5">
          <label htmlFor="fileStatus" className="block text-sm font-semibold text-gray-900 mb-1">
            File Status
          </label>
          <select
            id="fileStatus"
            value={fileStatus}
            onChange={e => setFileStatus(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-pacific-500 focus:ring-pacific-500 focus:outline-none"
          >
            <option value="">— select —</option>
            {FILE_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* SAP Material No */}
        <div className="px-6 py-5">
          <label htmlFor="sapMaterialNo" className="block text-sm font-semibold text-gray-900 mb-1">
            SAP Material No.
          </label>
          <input
            id="sapMaterialNo"
            type="text"
            value={sapMaterialNo}
            onChange={e => setSapMaterialNo(e.target.value)}
            placeholder="e.g. 1234567"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-pacific-500 focus:ring-pacific-500 focus:outline-none"
          />
        </div>

        {/* Error + submit */}
        <div className="px-6 py-5 bg-gray-50 rounded-b-xl flex items-center justify-between gap-4">
          <div className="flex-1">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/research/pcs/documents"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !pcsId.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-pacific-600 px-5 py-2 text-sm font-semibold text-white hover:bg-pacific-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating…
                </>
              ) : 'Create document'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
