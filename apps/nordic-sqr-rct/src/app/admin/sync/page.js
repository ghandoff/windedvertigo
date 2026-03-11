'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider } from '@/lib/useAuth';
import Toast from '@/components/Toast';

function SyncCard({ title, description, endpoint, options = [] }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeOptions, setActiveOptions] = useState({});

  const toggleOption = (key) => {
    setActiveOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const run = async (dryRun) => {
    setLoading(true);
    setResult(null);
    setError(null);

    const params = new URLSearchParams();
    if (dryRun) params.set('dry_run', 'true');
    for (const opt of options) {
      if (activeOptions[opt.key]) params.set(opt.key, 'true');
    }

    try {
      const res = await fetch(`${endpoint}?${params}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-pacific">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      <div className="px-6 py-4">
        {/* Options toggles */}
        {options.length > 0 && (
          <div className="mb-4 space-y-2">
            {options.map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!activeOptions[opt.key]}
                  onChange={() => toggleOption(opt.key)}
                  className="rounded border-gray-300 text-pacific focus:ring-pacific"
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => run(true)}
            disabled={loading}
            className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Dry Run (preview)'}
          </button>
          <button
            onClick={() => run(false)}
            disabled={loading}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Live'}
          </button>
        </div>

        {/* Spinner */}
        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-pacific-200 border-t-pacific rounded-full animate-spin" />
            Processing... this may take a minute.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(result.summary).map(([key, value]) => {
                if (key === 'dryRun') return null;
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {formatLabel(key)}: <strong>{value}</strong>
                  </span>
                );
              })}
              {result.summary.dryRun && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  DRY RUN — no changes written
                </span>
              )}
            </div>

            {/* Detail sections */}
            {result.details && (
              <details className="text-sm">
                <summary className="cursor-pointer text-pacific font-medium hover:underline">
                  Show details
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded-lg overflow-x-auto text-xs leading-relaxed max-h-96 overflow-y-auto">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function SyncPageContent() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific">PCS Sync Tools</h1>
          <p className="text-gray-600 mt-2">
            Sync data between SQR-RCT and the PCS Evidence Library. Always run a dry run first to preview changes.
          </p>
        </div>

        <div className="space-y-6">
          <SyncCard
            title="Sync SQR-RCT Scores → Evidence Library"
            description="Matches SQR-RCT quality scores to PCS Evidence Library entries by DOI, then writes aggregated scores, risk of bias, and review metadata."
            endpoint="/api/admin/sync/evidence"
            options={[
              { key: 'update_packets', label: 'Also update Evidence Packets threshold (score ≥ 17)' },
            ]}
          />

          <SyncCard
            title="Ingredient Backfill"
            description="Scans Evidence Library entries that have no Ingredient tag, detects ingredients from the title, citation, and research summary using keyword matching, and writes tags back."
            endpoint="/api/admin/backfill/ingredients"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SyncPage() {
  return (
    <AuthProvider>
      <AdminRoute>
        <SyncPageContent />
      </AdminRoute>
    </AuthProvider>
  );
}
