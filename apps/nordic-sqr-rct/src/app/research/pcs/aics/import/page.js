'use client';

/**
 * /research/pcs/aics/import — Batch-import AICS documents.
 *
 * Accepts JSON or CSV input, parses it into a preview, then POSTs to
 * POST /api/pcs/aics/batch (cap-gated: aics.documents:create — RA+).
 *
 * Hard limit: 20 documents per batch (matches API cap).
 *
 * JSON format:
 * [
 *   {
 *     "aicsId": "AICS-0001",
 *     "aiName": "Vitamin D3",
 *     "classification": "Vitamin",
 *     "fileStatus": "Draft",
 *     "versions": [
 *       {
 *         "version": "1.0",
 *         "effectiveDate": "2024-01-15",
 *         "changeDescription": "Initial release",
 *         "isLatest": true,
 *         "claims": [
 *           { "claimId": "C-001", "claimText": "Supports bone health", "grade": "A" }
 *         ]
 *       }
 *     ]
 *   }
 * ]
 *
 * CSV format (flat, one doc per row — versions/claims not supported in CSV):
 * aicsId,aiName,classification,fileStatus
 * AICS-0001,Vitamin D3,Vitamin,Draft
 */

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';

const MAX_BATCH = 20;

// ── Parse helpers ─────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
  const headers = lines[0].split(',').map((h) => h.trim());
  const docs = lines.slice(1).map((line, i) => {
    const values = line.split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      if (values[idx] !== undefined) row[h] = values[idx];
    });
    if (!row.aicsId) throw new Error(`Row ${i + 2} is missing aicsId.`);
    return row;
  });
  return docs;
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of document objects.');
  parsed.forEach((doc, i) => {
    if (!doc?.aicsId) throw new Error(`Item ${i} is missing aicsId.`);
  });
  return parsed;
}

function countItems(docs) {
  let versions = 0;
  let claims = 0;
  for (const doc of docs) {
    versions += Array.isArray(doc.versions) ? doc.versions.length : 0;
    for (const ver of doc.versions || []) {
      claims += Array.isArray(ver.claims) ? ver.claims.length : 0;
    }
  }
  return { docs: docs.length, versions, claims };
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AicsImportPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState('json');
  const [inputText, setInputText] = useState('');
  const [preview, setPreview] = useState(null);   // { docs: [...], counts: {} }
  const [parseError, setParseError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);   // { created, errors }
  const [showFormat, setShowFormat] = useState(false);

  // ── Parse step ──────────────────────────────────────────────────────────

  function handleParse() {
    setParseError(null);
    setPreview(null);
    setResults(null);
    try {
      const text = inputText.trim();
      if (!text) throw new Error('Paste your data above before parsing.');
      const docs = mode === 'csv' ? parseCsv(text) : parseJson(text);
      if (docs.length > MAX_BATCH) {
        throw new Error(`Too many documents (${docs.length}). Maximum is ${MAX_BATCH} per batch.`);
      }
      const counts = countItems(docs);
      setPreview({ docs, counts });
    } catch (err) {
      setParseError(err.message);
    }
  }

  // ── Submit step ──────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!preview) return;
    setSubmitting(true);
    setResults(null);
    try {
      const res = await fetch('/api/pcs/aics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview.docs),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setResults(body);
      setPreview(null);
      setInputText('');
    } catch (err) {
      setParseError(err?.message || 'Batch import failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = can(user, 'aics.documents:create');

  if (!canCreate) {
    return (
      <div className="max-w-xl space-y-4">
        <nav className="text-xs text-gray-500 flex items-center gap-1">
          <Link href="/research/pcs/aics" className="hover:text-gray-700 transition">AICS Library</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Batch Import</span>
        </nav>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">
          <p className="font-semibold mb-1">Access restricted</p>
          <p>Batch import requires Research Associate, admin, or super-user access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 flex items-center gap-1">
        <Link href="/research/pcs/aics" className="hover:text-gray-700 transition">AICS Library</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Batch Import</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Import AICS Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import up to {MAX_BATCH} AICS documents at once — with nested versions and claims.
          Documents are created sequentially to stay within Notion API limits.
        </p>
      </div>

      {/* Success results */}
      {results && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-green-900">
            Import complete — {results.created?.length || 0} document{results.created?.length !== 1 ? 's' : ''} created
            {results.errors?.length > 0 ? `, ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''}` : ''}.
          </p>
          {results.errors?.length > 0 && (
            <ul className="text-xs text-red-700 space-y-1">
              {results.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.aicsId || `item ${e.index}`}</span>
                  {e.context ? ` (${e.context})` : ''}: {e.error}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <Link
              href="/research/pcs/aics"
              className="text-xs text-green-700 underline hover:text-green-900 transition"
            >
              View AICS Library
            </Link>
            <button
              onClick={() => setResults(null)}
              className="text-xs text-gray-500 hover:text-gray-700 transition"
            >
              Import another batch
            </button>
          </div>
        </div>
      )}

      {!results && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Format:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {['json', 'csv'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setPreview(null); setParseError(null); }}
                  className={`px-4 py-1.5 font-medium transition ${
                    mode === m
                      ? 'bg-pacific-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFormat((s) => !s)}
              className="text-xs text-gray-400 hover:text-gray-600 transition underline"
            >
              {showFormat ? 'Hide format' : 'Show format'}
            </button>
          </div>

          {/* Format reference */}
          {showFormat && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-xs font-mono text-gray-700 whitespace-pre overflow-x-auto">
              {mode === 'json' ? `[
  {
    "aicsId": "AICS-0001",          // required
    "aiName": "Vitamin D3",
    "classification": "Vitamin",
    "fileStatus": "Draft",
    "versions": [
      {
        "version": "1.0",           // required
        "effectiveDate": "2024-01-15",
        "changeDescription": "Initial release",
        "isLatest": true,
        "claims": [
          {
            "claimId": "C-001",     // required
            "claimText": "Supports bone health",
            "grade": "A",
            "benefitCategory": "Bone Health"
          }
        ]
      }
    ]
  }
]` : `aicsId,aiName,classification,fileStatus
AICS-0001,Vitamin D3,Vitamin,Draft
AICS-0002,Magnesium,Mineral,Draft`}
            </div>
          )}

          {/* Input textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste {mode.toUpperCase()} data
            </label>
            <textarea
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); setPreview(null); setParseError(null); }}
              placeholder={mode === 'json' ? '[{"aicsId": "AICS-0001", ...}]' : 'aicsId,aiName,...'}
              rows={10}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pacific-500 focus:border-transparent resize-y"
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* Parse button */}
          {!preview && (
            <button
              onClick={handleParse}
              className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition"
            >
              Parse &amp; Preview
            </button>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg border border-pacific-100 bg-pacific-50 px-4 py-3">
                <p className="text-sm font-medium text-pacific-900">
                  Ready to import: {preview.counts.docs} document{preview.counts.docs !== 1 ? 's' : ''}
                  {preview.counts.versions > 0 ? `, ${preview.counts.versions} version${preview.counts.versions !== 1 ? 's' : ''}` : ''}
                  {preview.counts.claims > 0 ? `, ${preview.counts.claims} claim${preview.counts.claims !== 1 ? 's' : ''}` : ''}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">AICS ID</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Classification</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Versions</th>
                      <th className="text-right px-3 py-2">Claims</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.docs.map((doc, i) => {
                      const vCount = Array.isArray(doc.versions) ? doc.versions.length : 0;
                      const cCount = (doc.versions || []).reduce(
                        (sum, v) => sum + (Array.isArray(v.claims) ? v.claims.length : 0),
                        0,
                      );
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-gray-900">{doc.aicsId}</td>
                          <td className="px-3 py-2 text-gray-700">{doc.aiName || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{doc.classification || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{doc.fileStatus || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{vCount || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{cCount || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-pacific-600 hover:bg-pacific-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting && (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  {submitting ? 'Importing…' : `Import ${preview.counts.docs} document${preview.counts.docs !== 1 ? 's' : ''}`}
                </button>
                <button
                  onClick={() => { setPreview(null); setParseError(null); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  Edit
                </button>
              </div>

              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠ Notion has no bulk delete. Double-check AICS IDs before importing — duplicates must be removed manually.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
