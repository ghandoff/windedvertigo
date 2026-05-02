'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const toggleOption = (key) => {
    setActiveOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const run = async (dryRun) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setElapsed(0);

    // Start elapsed timer
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    const params = new URLSearchParams();
    if (dryRun) params.set('dry_run', 'true');
    for (const opt of options) {
      if (activeOptions[opt.key]) params.set(opt.key, 'true');
    }

    try {
      const res = await fetch(`${endpoint}?${params}`, { method: 'POST' });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Vercel timeout returns HTML, not JSON
        throw new Error(
          res.status === 504
            ? 'Request timed out — try running again (it will continue where it left off)'
            : `Server returned invalid response (${res.status})`
        );
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setLoading(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  function formatElapsed(s) {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

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

        {/* Progress indicator */}
        {loading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-4 h-4 border-2 border-pacific-200 border-t-pacific rounded-full animate-spin" />
                Processing...
              </div>
              <span className="text-gray-400 tabular-nums">{formatElapsed(elapsed)}</span>
            </div>
            {/* Animated progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-pacific-500 rounded-full animate-progress" />
            </div>
            <p className="text-xs text-gray-400">
              {elapsed < 10
                ? 'Scanning databases...'
                : elapsed < 30
                  ? 'Processing entries...'
                  : elapsed < 120
                    ? 'Still working — large databases take a few minutes...'
                    : 'Almost there — finishing up...'}
            </p>
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
            {result.summary && (
              <div className="flex flex-wrap gap-2 mb-3">
                {flattenSummary(result.summary).map(([label, value]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {label}: <strong>{value}</strong>
                  </span>
                ))}
                {result.summary.dryRun && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    DRY RUN — no changes written
                  </span>
                )}
              </div>
            )}

            {/* Remaining items indicator */}
            {result.summary?.remaining > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-3">
                <strong>{result.summary.remaining} entries remaining.</strong> Run again to process the next batch.
              </div>
            )}

            {/* Zero-match warning */}
            {result.summary?.matched === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-3">
                <strong>No DOI matches found.</strong> The SQR-RCT studies and PCS evidence entries don&apos;t share any DOIs.
                Check that both databases have DOIs populated and that the DOI formats are compatible (e.g. <code className="text-xs bg-amber-100 px-1 rounded">10.1016/...</code> or <code className="text-xs bg-amber-100 px-1 rounded">https://doi.org/10.1016/...</code>).
              </div>
            )}

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

/**
 * Flatten a summary object into [label, value] pairs for display.
 * Handles nested objects (e.g. { pcs: { total: 74, fetched: 3 } })
 * by prefixing keys: "PCS Total", "PCS Fetched".
 */
function flattenSummary(summary) {
  const entries = [];
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'dryRun') continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Nested: flatten with prefix
      const prefix = formatLabel(key);
      for (const [subKey, subVal] of Object.entries(value)) {
        entries.push([`${prefix} ${formatLabel(subKey)}`, String(subVal ?? '—')]);
      }
    } else {
      entries.push([formatLabel(key), String(value ?? '—')]);
    }
  }
  return entries;
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="pt-2">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function PipelineStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/admin/sync/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setStatus(data))
      .catch(() => {});
  }, []);

  const gates = [
    {
      key: 'autoFeed',
      label: 'Auto-Feed',
      envVar: 'PCS_AUTO_FEED',
      onDesc: 'New PCS evidence items auto-create SQR-RCT intake entries for review.',
      offDesc: 'Evidence items are sent to review manually via the "Send to SQR-RCT Review" button.',
    },
    {
      key: 'autoSync',
      label: 'Auto-Sync',
      envVar: 'PCS_AUTO_SYNC',
      onDesc: 'SQR-RCT scores auto-propagate to PCS Evidence Library on submission.',
      offDesc: 'Scores are only synced via manual bulk sync below.',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Pipeline diagram */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Pipeline</h2>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">PCS Evidence</span>
          <span>→</span>
          <span className={`font-medium px-2 py-1 rounded ${status?.autoFeed ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
            auto-feed {status?.autoFeed ? 'ON' : 'OFF'}
          </span>
          <span>→</span>
          <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">SQR-RCT Queue</span>
          <span>→</span>
          <span className="text-gray-400">reviewers score</span>
          <span>→</span>
          <span className={`font-medium px-2 py-1 rounded ${status?.autoSync ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
            auto-sync {status?.autoSync ? 'ON' : 'OFF'}
          </span>
          <span>→</span>
          <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">PCS Evidence</span>
        </div>
      </div>

      {/* Gate cards */}
      {gates.map(gate => {
        const enabled = status?.[gate.key];
        return (
          <div key={gate.key} className={`rounded-xl border overflow-hidden ${enabled ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <h2 className="text-lg font-semibold text-gray-900">{gate.label}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${enabled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {status ? (enabled ? 'Active' : 'Off') : '...'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {enabled ? gate.onDesc : gate.offDesc}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500 max-w-[200px]">
                <p>Controlled by <code className="bg-white/60 px-1.5 py-0.5 rounded text-[11px] font-mono">{gate.envVar}</code></p>
                <p className="mt-1">Set to <code className="bg-white/60 px-1.5 py-0.5 rounded text-[11px] font-mono">true</code> in Vercel env vars to enable</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SyncPageContent() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:px-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/admin" className="hover:text-pacific transition">Admin</Link>
            <span>/</span>
            <span className="text-gray-700">Sync Tools</span>
          </div>
          <h1 className="text-3xl font-bold text-pacific">Sync Tools</h1>
          <p className="text-gray-600 mt-2">
            Sync data between SQR-RCT scores and the PCS Evidence Library. Always run a dry run first to preview changes.
          </p>
        </div>

        <div className="space-y-6">
          <PipelineStatus />

          {/* Section: Data Quality */}
          <SectionHeading
            title="Data Quality"
            subtitle="Fix missing identifiers and metadata — run these first before syncing or scoring."
          />

          <SyncCard
            title="1. DOI Backfill"
            description="Scans PCS Evidence Library and SQR-RCT Intake DB for entries missing DOIs, searches PubMed by PMID or title/author, and populates DOI fields. Also backfills PMIDs when found."
            endpoint="/api/admin/backfill/dois"
          />

          <SyncCard
            title="2. PDF Backfill"
            description="Scans PCS Evidence Library and SQR-RCT Intake DB for entries missing PDFs. Searches 7 open-access sources (Unpaywall, Semantic Scholar, CORE, OpenAlex, Europe PMC, bioRxiv/medRxiv, NCBI PMC), downloads found PDFs, uploads to Blob storage, and cross-links between databases by DOI."
            endpoint="/api/admin/backfill/pdfs"
          />

          <SyncCard
            title="3. Bulk Enrich from PubMed"
            description="Scans Evidence Library for entries with a DOI or PMID but missing metadata (summary, ingredients, year). Fetches from PubMed, generates Claude summaries, and runs context-aware ingredient detection. Uses full article text from PDFs when available."
            endpoint="/api/admin/enrich"
          />

          <SyncCard
            title="4. Ingredient Backfill (keyword)"
            description="Fast keyword-based fallback: scans Evidence Library entries that have no Ingredient tag, detects ingredients from the title, citation, and research summary using pattern matching. Use Bulk Enrich above for smarter context-aware detection."
            endpoint="/api/admin/backfill/ingredients"
          />

          {/* Section: Score Sync */}
          <SectionHeading
            title="Score Sync"
            subtitle="Propagate SQR-RCT review scores back to the PCS Evidence Library."
          />

          <SyncCard
            title="Sync SQR-RCT Scores → Evidence Library"
            description="Matches SQR-RCT quality scores to PCS Evidence Library entries by DOI, then writes aggregated scores, risk of bias, and review metadata."
            endpoint="/api/admin/sync/evidence"
            options={[
              { key: 'update_packets', label: 'Also update Evidence Packets threshold (score ≥ 17)' },
            ]}
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
