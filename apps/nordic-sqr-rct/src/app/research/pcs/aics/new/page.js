'use client';

/**
 * /research/pcs/aics/new — Create a new AICS document.
 *
 * POSTs to POST /api/pcs/aics with { aicsId, aiName, classification, fileStatus }.
 * On success, redirects to the new doc's detail page at /research/pcs/aics/[id].
 *
 * Cap-gated: the AICS list page already requires aics.documents:create
 * (RA / admin / super-user). Researcher role → the "+ New AICS doc" button
 * is hidden on the list page so they never land here; if they navigate
 * directly, the API will 403.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Controlled-vocab options matching the Notion AICS Documents database selects.
const CLASSIFICATION_OPTIONS = [
  'Vitamin',
  'Mineral',
  'Herb / Botanical',
  'Amino Acid',
  'Fatty Acid / Lipid',
  'Probiotic',
  'Enzyme',
  'Phytonutrient',
  'Other',
];

const FILE_STATUS_OPTIONS = [
  'Draft',
  'In Review',
  'Approved',
  'Archived',
];

export default function NewAicsDocPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    aicsId: '',
    aiName: '',
    classification: '',
    fileStatus: 'Draft',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const aicsId = form.aicsId.trim();
    if (!aicsId) {
      setError('AICS ID is required (e.g. AICS-0004).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { aicsId };
      if (form.aiName.trim())      payload.aiName        = form.aiName.trim();
      if (form.classification)     payload.classification = form.classification;
      if (form.fileStatus)         payload.fileStatus     = form.fileStatus;

      const res = await fetch('/api/pcs/aics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }

      // Navigate to the new doc's detail page.
      // The API returns the full doc object; id is the Notion page_id.
      const docId = body?.id || body?.notionPageId;
      if (docId) {
        router.push(`/research/pcs/aics/${docId}`);
      } else {
        router.push('/research/pcs/aics');
      }
    } catch (err) {
      setError(err?.message || 'Failed to create AICS document.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 flex items-center gap-1">
        <Link href="/research/pcs/aics" className="hover:text-gray-700 transition">
          AICS Library
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">New document</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New AICS Document</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new Active Ingredient Claim Substantiation document. One AICS doc
          per active ingredient — it feeds into all related PCS documents by reference.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* AICS ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            AICS ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.aicsId}
            onChange={(e) => set('aicsId', e.target.value)}
            placeholder="e.g. AICS-0004"
            disabled={submitting}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:border-transparent disabled:opacity-50"
            required
          />
          <p className="mt-1 text-xs text-gray-400">
            Sequential identifier used across Notion and Postgres (e.g. AICS-0001, AICS-0042).
          </p>
        </div>

        {/* Active Ingredient Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Active Ingredient Name
          </label>
          <input
            type="text"
            value={form.aiName}
            onChange={(e) => set('aiName', e.target.value)}
            placeholder="e.g. Vitamin D3 (Cholecalciferol)"
            disabled={submitting}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Classification */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Classification
          </label>
          <select
            value={form.classification}
            onChange={(e) => set('classification', e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">— Select classification —</option>
            {CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* File Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            File Status
          </label>
          <select
            value={form.fileStatus}
            onChange={(e) => set('fileStatus', e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:border-transparent disabled:opacity-50"
          >
            {FILE_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-pacific-600 hover:bg-pacific-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? 'Creating…' : 'Create AICS Document'}
          </button>
          <Link
            href="/research/pcs/aics"
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Help note */}
      <p className="text-xs text-gray-400">
        After creation you&apos;ll be taken to the document detail page where you can add
        claims, link to PCS documents, and manage version history.
      </p>
    </div>
  );
}
