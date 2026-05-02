'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

/**
 * Reusable PCS table with sort, filter, and inline editing.
 *
 * columns: [{ key, label, sortable?, editable?, type?, options?, render? }]
 * data: array of row objects
 * onUpdate: (id, field, value) => Promise<void>  — for inline editing
 * tableKey: string — unique key for this table (e.g. 'claims', 'evidence')
 * userId: string — current user's ID for per-account sort persistence
 */
export default function PcsTable({ columns, data, onUpdate, emptyMessage = 'No data found', tableKey, userId }) {
  // Load saved sort preference from localStorage (per user + table)
  const storageKey = tableKey && userId ? `pcs-sort-${userId}-${tableKey}` : null;

  function loadSavedSort() {
    if (!storageKey) return { key: null, dir: 'asc' };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { key: null, dir: 'asc' };
  }

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [sortLoaded, setSortLoaded] = useState(false);
  const [filter, setFilter] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { rowId, key }
  const [editValue, setEditValue] = useState('');
  const escapedRef = useRef(false);

  // Hydrate saved sort on mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = loadSavedSort();
    if (saved.key) {
      setSortKey(saved.key);
      setSortDir(saved.dir || 'asc');
    }
    setSortLoaded(true);
  }, [storageKey]);

  // Persist sort preference when it changes
  useEffect(() => {
    if (!storageKey || !sortLoaded) return;
    try {
      if (sortKey) {
        localStorage.setItem(storageKey, JSON.stringify({ key: sortKey, dir: sortDir }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch { /* ignore */ }
  }, [storageKey, sortKey, sortDir, sortLoaded]);

  const sorted = useMemo(() => {
    let filtered = data;
    if (filter) {
      const q = filter.toLowerCase();
      filtered = data.filter(row =>
        columns.some(col => {
          const val = row[col.key];
          if (val == null) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, columns, sortKey, sortDir, filter]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function startEdit(rowId, key, currentValue) {
    setEditingCell({ rowId, key });
    setEditValue(currentValue ?? '');
  }

  async function commitEdit(rowId, key) {
    if (onUpdate) {
      await onUpdate(rowId, key, editValue);
    }
    setEditingCell(null);
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Filter..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
      />
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-pacific">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {columns.map(col => {
                    const isEditing = editingCell?.rowId === row.id && editingCell?.key === col.key;
                    const value = row[col.key];

                    if (isEditing && col.editable) {
                      if (col.type === 'select') {
                        return (
                          <td key={col.key} className="px-4 py-2">
                            <select
                              value={editValue}
                              onChange={e => { setEditValue(e.target.value); commitEdit(row.id, col.key); }}
                              onBlur={() => { if (!escapedRef.current) commitEdit(row.id, col.key); escapedRef.current = false; }}
                              onKeyDown={e => { if (e.key === 'Escape') { escapedRef.current = true; cancelEdit(); } }}
                              autoFocus
                              className="text-sm border border-pacific rounded px-2 py-1"
                            >
                              {(col.options || []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="px-4 py-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { if (!escapedRef.current) commitEdit(row.id, col.key); escapedRef.current = false; }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(row.id, col.key);
                              if (e.key === 'Escape') { escapedRef.current = true; cancelEdit(); }
                            }}
                            autoFocus
                            className="text-sm border border-pacific rounded px-2 py-1 w-full"
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-2 text-sm text-gray-700 ${col.editable ? 'cursor-pointer hover:bg-pacific-50' : ''}`}
                        onClick={() => col.editable && startEdit(row.id, col.key, value)}
                      >
                        {col.render ? col.render(value, row) : (value ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{sorted.length} of {data.length} rows</p>
    </div>
  );
}
