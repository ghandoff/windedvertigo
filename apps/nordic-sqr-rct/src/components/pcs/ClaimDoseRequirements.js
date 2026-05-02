'use client';

import { useState, useEffect, useCallback } from 'react';
import { AI_UNITS } from '@/lib/pcs-config';

/**
 * Inline editor for a claim's dose requirements.
 *
 * Lauren's template Table 3A supports multiple (AI, amount, unit) rows
 * per claim with OR logic — "Vitamin D 600 IU OR Magnesium 200 mg" means
 * either alone substantiates the claim. Rows with the same
 * combinationGroup are AND; different groups are OR. Most claims are
 * pure OR (one row per group), so the default combinationGroup is
 * auto-incremented per new row.
 */
export default function ClaimDoseRequirements({ claimId, canWrite }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    activeIngredient: '', aiForm: '', amount: '', unit: 'mg', combinationGroup: 1,
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pcs/claim-dose-reqs?claimId=${claimId}`);
      if (!res.ok) throw new Error('Failed to load dose requirements');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  async function saveNew() {
    if (!newRow.activeIngredient.trim() || !newRow.amount) {
      setError('Active Ingredient and Amount are required');
      return;
    }
    setError('');
    const payload = {
      pcsClaimId: claimId,
      activeIngredient: newRow.activeIngredient.trim(),
      aiForm: newRow.aiForm.trim() || undefined,
      amount: Number(newRow.amount),
      unit: newRow.unit,
      // Default to a new group number so rows are OR by default
      combinationGroup: newRow.combinationGroup || (rows.length + 1),
    };
    const res = await fetch('/api/pcs/claim-dose-reqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Save failed');
      return;
    }
    setNewRow({ activeIngredient: '', aiForm: '', amount: '', unit: 'mg', combinationGroup: rows.length + 2 });
    setAdding(false);
    load();
  }

  async function deleteRow(id) {
    if (!confirm('Remove this dose requirement?')) return;
    const res = await fetch(`/api/pcs/claim-dose-reqs/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  // Group rows by combinationGroup for AND/OR rendering
  const groups = {};
  for (const row of rows) {
    const g = row.combinationGroup ?? 1;
    if (!groups[g]) groups[g] = [];
    groups[g].push(row);
  }
  const groupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-500 block">
          Dose Requirements
          <span className="text-gray-400 font-normal ml-2">(Lauren&apos;s template Table 3A)</span>
        </label>
        {canWrite && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-pacific-600 hover:underline"
          >
            + Add requirement
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-gray-400">Loading…</p>}

      {!loading && rows.length === 0 && !adding && (
        <p className="text-sm text-gray-400 italic">No dose requirements set.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {groupKeys.map((gKey, idx) => (
            <div key={gKey}>
              {idx > 0 && (
                <p className="text-xs font-mono text-gray-400 my-1 text-center">— OR —</p>
              )}
              <div className="space-y-1">
                {groups[gKey].map((row, rIdx) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 text-sm bg-gray-50 rounded px-2 py-1.5"
                  >
                    {rIdx > 0 && <span className="text-xs font-mono text-gray-400">AND</span>}
                    <span className="font-medium text-gray-900">{row.activeIngredient || '—'}</span>
                    {row.aiForm && <span className="text-xs text-gray-500">({row.aiForm})</span>}
                    <span className="text-gray-700">
                      {row.amount != null ? row.amount : '?'} {row.unit || ''}
                    </span>
                    {canWrite && (
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="ml-auto text-xs text-red-600 hover:underline"
                      >
                        remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && canWrite && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input
              type="text"
              placeholder="AI (e.g., Magnesium)"
              value={newRow.activeIngredient}
              onChange={e => setNewRow({ ...newRow, activeIngredient: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1 md:col-span-2"
            />
            <input
              type="text"
              placeholder="Form (optional)"
              value={newRow.aiForm}
              onChange={e => setNewRow({ ...newRow, aiForm: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            />
            <input
              type="number"
              placeholder="Amount"
              value={newRow.amount}
              onChange={e => setNewRow({ ...newRow, amount: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1"
              step="any"
            />
            <select
              value={newRow.unit}
              onChange={e => setNewRow({ ...newRow, unit: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            >
              {AI_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <label>Combination group:</label>
            <input
              type="number"
              min="1"
              value={newRow.combinationGroup}
              onChange={e => setNewRow({ ...newRow, combinationGroup: Number(e.target.value) || 1 })}
              className="w-16 text-xs border border-gray-300 rounded px-1 py-0.5"
            />
            <span className="text-gray-400">(same group = AND; different groups = OR)</span>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setError(''); }}
              className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={saveNew}
              className="text-xs px-3 py-1 bg-pacific-600 text-white rounded hover:bg-pacific-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
