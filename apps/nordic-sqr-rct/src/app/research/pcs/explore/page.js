'use client';

/**
 * Budget C Preview — Marketing Intelligence Interface
 * Route: /research/pcs/explore
 *
 * Super-user-only (gated via RoleRoute + server-side capability check on
 * every API call). Sharon gets a demo; Nordic org sees nothing until payment.
 *
 * Three lenses:
 *   By Benefit Category — "Which ingredients/products support [Eye Health]?"
 *   By Ingredient       — "What can [Magnesium] support, and at what dose?"
 *   By Product          — "What claims can [product] make?"
 *
 * Substantiation Status (Supported/Thin/Unsupported) is derived transparently
 * from evidence count + SQR-RCT scores. Hover the badge to see the inputs.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import RoleRoute from '@/components/RoleRoute';
import { CLAIM_AUTHORITY_REGIONS } from '@/lib/pcs-config';

const LENSES = [
  { key: 'benefit',     label: 'By Benefit Category', placeholder: 'Select a benefit category…' },
  { key: 'ingredient',  label: 'By Ingredient',        placeholder: 'Select an ingredient…' },
  { key: 'product',     label: 'By Product',           placeholder: 'Select a product…' },
];

const STATUS_STYLES = {
  'Supported':   { pill: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  'Thin':        { pill: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  'Unsupported': { pill: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
};

function StatusBadge({ status, statusInputs }) {
  const style = STATUS_STYLES[status] || { pill: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  const { evidenceCount, meanScore, scoreCount } = statusInputs || {};

  const tooltip = [
    `${evidenceCount ?? 0} supporting ${evidenceCount === 1 ? 'study' : 'studies'}`,
    scoreCount > 0 ? `mean SQR-RCT ${(meanScore * 100).toFixed(0)}% (${scoreCount} scored)` : 'no SQR-RCT scores on file',
  ].join(' · ');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${style.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

function ExplorerTable({ rows, onSelectForDossier, selectedIds }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No claims found for this selection.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-4 py-3">
              <input
                type="checkbox"
                checked={rows.length > 0 && rows.every(r => selectedIds.has(r.claimId))}
                onChange={e => {
                  const next = new Set(selectedIds);
                  rows.forEach(r => e.target.checked ? next.add(r.claimId) : next.delete(r.claimId));
                  onSelectForDossier(next);
                }}
                className="rounded border-gray-300"
                aria-label="Select all"
              />
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Claim</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Ingredient / Dose</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Benefit Category</th>
            <th className="px-4 py-3 text-center font-semibold text-gray-700">Evidence</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Authorities</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">PCS Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map(row => (
            <tr key={row.claimId} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.claimId)}
                  onChange={e => {
                    const next = new Set(selectedIds);
                    e.target.checked ? next.add(row.claimId) : next.delete(row.claimId);
                    onSelectForDossier(next);
                  }}
                  className="rounded border-gray-300"
                  aria-label="Select claim"
                />
              </td>
              <td className="px-4 py-3 max-w-xs">
                <p className="font-medium text-gray-900 leading-snug">{row.claimText || '(no text)'}</p>
                {row.canonicalClaimText && row.canonicalClaimText !== row.claimText && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate" title={row.canonicalClaimText}>
                    Canonical: {row.canonicalClaimText}
                  </p>
                )}
                {row.claimBucket && (
                  <span className="inline-block mt-1 text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                    Table {row.claimBucket}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="text-gray-700">{row.ingredient?.name || '—'}</p>
                {row.dose && <p className="text-xs text-gray-500 mt-0.5">{row.dose}</p>}
              </td>
              <td className="px-4 py-3 text-gray-600">{row.benefitCategory?.name || '—'}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold bg-pacific-50 text-pacific-700"
                  title={`${row.evidenceCount} supporting ${row.evidenceCount === 1 ? 'study' : 'studies'}`}
                >
                  {row.evidenceCount}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} statusInputs={row.statusInputs} />
              </td>
              <td className="px-4 py-3">
                {row.authorityRegions && row.authorityRegions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {row.authorityRegions.map(r => (
                      <span key={r} className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
                        {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-300 italic">Not assessed</span>
                )}
              </td>
              <td className="px-4 py-3">
                {row.pcsRef ? (
                  <a
                    href={row.pcsRef}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pacific-600 hover:text-pacific-800 underline text-xs"
                  >
                    View PCS →
                  </a>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DossierPanel({ selectedIds, onExport }) {
  const [signedOffBy, setSignedOffBy] = useState('');
  const [exporting, setExporting] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const isDraft = signedOffBy.trim().length === 0;

  const handleExport = async () => {
    setExporting(true);
    await onExport(Array.from(selectedIds), signedOffBy.trim() || null);
    setExporting(false);
  };

  return (
    <div className="rounded-lg border border-pacific-200 bg-pacific-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-pacific-900 text-sm">
            Generate Substantiation Dossier
          </p>
          <p className="text-xs text-pacific-700 mt-0.5">
            {count} claim{count !== 1 ? 's' : ''} selected
          </p>
        </div>
        {isDraft && (
          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            Will be watermarked DRAFT
          </span>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-pacific-800">
          Human reviewer sign-off <span className="text-gray-400">(optional — omit for DRAFT)</span>
        </label>
        <input
          type="text"
          value={signedOffBy}
          onChange={e => setSignedOffBy(e.target.value)}
          placeholder="Your full name to sign off as final…"
          className="w-full rounded border border-pacific-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pacific-400"
        />
        {!isDraft && (
          <p className="text-xs text-green-700">
            ✓ Export will be marked as reviewed by <strong>{signedOffBy.trim()}</strong>
          </p>
        )}
      </div>

      <div className="pt-1">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Generating…' : `Export .docx${isDraft ? ' (DRAFT)' : ''}`}
        </button>
        <p className="text-xs text-pacific-600 mt-1.5">
          {isDraft
            ? 'A DRAFT watermark will appear on every page. Provide your name above for a final export.'
            : 'This will produce a finalized dossier attributed to the named reviewer.'}
        </p>
      </div>
    </div>
  );
}

function ExploreContent() {
  const [activeLens, setActiveLens] = useState('benefit');
  const [options, setOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [rows, setRows] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load filter options on mount
  useEffect(() => {
    setOptionsLoading(true);
    fetch('/api/pcs/explore')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setOptions(data))
      .catch(err => setError(String(err)))
      .finally(() => setOptionsLoading(false));
  }, []);

  // Reset selection when lens changes
  const handleLensChange = (key) => {
    setActiveLens(key);
    setSelectedId('');
    setRows(null);
    setSelectedIds(new Set());
    setError(null);
  };

  // Query when a filter option is selected
  const handleSelectChange = useCallback(async (id) => {
    setSelectedId(id);
    setSelectedIds(new Set());
    if (!id) { setRows(null); return; }
    setQueryLoading(true);
    setError(null);
    try {
      const regionParam = regionFilter ? `&region=${encodeURIComponent(regionFilter)}` : '';
      const res = await fetch(`/api/pcs/explore?lens=${activeLens}&id=${encodeURIComponent(id)}${regionParam}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setError(String(err));
      setRows(null);
    } finally {
      setQueryLoading(false);
    }
  }, [activeLens, regionFilter]);

  // Re-query when region filter changes (if a selection is already active)
  useEffect(() => {
    if (selectedId) handleSelectChange(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter]);

  const handleExport = async (claimIds, signedOffBy) => {
    try {
      const res = await fetch('/api/pcs/explore/dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimIds, signedOffBy }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `substantiation-dossier-${signedOffBy ? '' : 'DRAFT-'}${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const lensOptions = options
    ? (activeLens === 'benefit'
        ? options.benefitCategories
        : activeLens === 'ingredient'
          ? options.ingredients
          : options.documents)
    : [];

  const activeLensMeta = LENSES.find(l => l.key === activeLens);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Marketing Intelligence</h1>
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Budget C Preview
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl">
          Query substantiation evidence across the PCS corpus by benefit category, ingredient, or product.
          Substantiation status (Supported/Thin/Unsupported) is derived transparently from evidence count and
          SQR-RCT quality scores — hover any status badge to see the inputs.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-2 inline-block">
          ⚠ Super-user preview only. Not visible to Nordic team members until Budget C payment clears.
        </p>
      </div>

      {/* Lens tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {LENSES.map(lens => (
          <button
            key={lens.key}
            onClick={() => handleLensChange(lens.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              activeLens === lens.key
                ? 'text-pacific-700 border-pacific-500 bg-white'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {lens.label}
          </button>
        ))}
      </div>

      {/* Filter row — lens select + authority region filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          {optionsLoading ? (
            <div className="h-10 bg-gray-100 rounded w-80 animate-pulse" />
          ) : error && !options ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : (
            <select
              value={selectedId}
              onChange={e => handleSelectChange(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pacific-400 w-full max-w-sm"
            >
              <option value="">{activeLensMeta?.placeholder || 'Select…'}</option>
              {(lensOptions || []).map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}{opt.pcsId ? ` (${opt.pcsId})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Authority / Region
          </label>
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pacific-400"
          >
            <option value="">All regions</option>
            {CLAIM_AUTHORITY_REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {regionFilter && (
          <button
            onClick={() => setRegionFilter('')}
            className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-2"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Results */}
      {queryLoading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-pacific rounded-full animate-spin" />
          Loading claims…
        </div>
      )}

      {!queryLoading && error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {!queryLoading && rows !== null && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {rows.length} claim{rows.length !== 1 ? 's' : ''} found
              {selectedIds.size > 0 && (
                <span className="ml-2 text-pacific-600 font-medium">
                  · {selectedIds.size} selected for dossier
                </span>
              )}
            </p>
            {rows.length > 0 && (
              <p className="text-xs text-gray-400">
                Hover any status badge to see evidence count and mean SQR-RCT score
              </p>
            )}
          </div>
          <ExplorerTable
            rows={rows}
            selectedIds={selectedIds}
            onSelectForDossier={setSelectedIds}
          />
          <DossierPanel selectedIds={selectedIds} onExport={handleExport} />
        </>
      )}

      {!queryLoading && rows === null && !error && selectedId === '' && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">Select a {activeLensMeta?.label?.toLowerCase().replace('by ', '')} above to view claims</p>
          <p className="text-xs text-gray-300 mt-1">Claims will show their ingredient, dose, evidence count, and substantiation status</p>
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <RoleRoute requires={['super-user']}>
      <ExploreContent />
    </RoleRoute>
  );
}
