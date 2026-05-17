'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

/**
 * Reusable PCS table with sort, filter, inline editing, and row expansion.
 *
 * columns: [{ key, label, sortable?, editable?, type?, options?, render? }]
 * data: array of row objects
 * onUpdate: (id, field, value) => Promise<void>  — for inline editing
 * tableKey: string — unique key for this table (e.g. 'claims', 'evidence')
 * userId: string — current user's ID for per-account sort persistence
 * expandRender: (row) => JSX — when provided, each row becomes clickable and
 *   reveals an expansion panel below it showing the returned content. A narrow
 *   chevron column is prepended automatically; no changes needed at call sites
 *   that don't use this prop.
 */
export default function PcsTable({
  columns,
  data,
  onUpdate,
  emptyMessage = 'No data found',
  tableKey,
  userId,
  // 2026-05-05 — Default sort applied when neither the user nor a parent
  // page has chosen a sort. Pass `defaultSortKey="lastEditedTime"` +
  // `defaultSortDir="desc"` for evidence/documents so newly-added rows
  // surface at the top instead of being buried alphabetically.
  defaultSortKey = null,
  defaultSortDir = 'asc',
  // 2026-05-05 — When the parent page renders its own filter input
  // (e.g. ingredients page-level search across name + synonyms),
  // pass `hideFilter` to suppress this built-in filter so the operator
  // doesn't see two stacked filter boxes against the same table.
  hideFilter = false,
  // 2026-05-16 — Callers can override the placeholder and sr-only label
  // to give context-specific copy (e.g. "Search evidence library…" on the
  // evidence page). Defaults kept intentionally generic so existing callers
  // (claims, documents, ingredients, etc.) don't need any changes.
  filterPlaceholder = 'Search…',
  filterLabel = 'Search rows',
  // 2026-05-17 — Optional row expansion. Pass a render function that receives
  // the full row object and returns JSX. When provided, a chevron column is
  // prepended and clicking a row toggles the expansion panel below it.
  expandRender = null,
}) {
  // Load saved sort preference from localStorage (per user + table).
  // 2026-05-05 — Bumped key version from `pcs-sort-` to `pcs-sort-v2-`
  // when defaultSortKey was introduced. Older saved prefs become stale
  // and the default applies on first visit; subsequent column-header
  // clicks save under the new key. Migration is one-time and lossless
  // (users just re-click the column they want, if different from the
  // new default of "most recently edited").
  const storageKey = tableKey && userId ? `pcs-sort-v2-${userId}-${tableKey}` : null;

  function loadSavedSort() {
    const fallback = { key: defaultSortKey, dir: defaultSortDir };
    if (!storageKey) return fallback;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return fallback;
  }

  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [sortLoaded, setSortLoaded] = useState(false);
  const [filter, setFilter] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { rowId, key }
  const [editValue, setEditValue] = useState('');
  const escapedRef = useRef(false);
  // Row expansion — tracks which row IDs are currently expanded.
  const [expandedRows, setExpandedRows] = useState(new Set());

  function toggleExpand(id) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Hydrate saved sort on mount (avoids SSR mismatch). The defaults
  // are applied via useState above; this effect only overrides when
  // the operator has a saved preference. The setState-in-effect rule
  // is intentionally suppressed: localStorage isn't accessible during
  // SSR, so a lazy useState initializer would mismatch hydration. The
  // canonical React pattern for this case is exactly what's below.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    const saved = loadSavedSort();
    if (saved.key) {
      setSortKey(saved.key);
      setSortDir(saved.dir || 'asc');
    }
    setSortLoaded(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
      {!hideFilter && (
        <div>
          <label htmlFor={`pcs-table-filter-${tableKey || 'default'}`} className="sr-only">
            {filterLabel}
          </label>
          <input
            id={`pcs-table-filter-${tableKey || 'default'}`}
            type="text"
            placeholder={filterPlaceholder}
            aria-label={filterLabel}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full max-w-sm px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Chevron column — only rendered when expandRender is provided */}
              {expandRender && (
                <th className="w-7 px-2 py-2.5" aria-label="Expand row" />
              )}
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
                <td colSpan={columns.length + (expandRender ? 1 : 0)} className="px-4 py-8 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(row => {
                const isExpanded = expandRender && expandedRows.has(row.id);
                return (
                  <>
                    <tr
                      key={row.id}
                      className={`transition-colors ${expandRender ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/70'}`}
                      onClick={expandRender ? () => toggleExpand(row.id) : undefined}
                    >
                      {/* Expand chevron */}
                      {expandRender && (
                        <td className="w-7 px-2 py-2 text-gray-400" onClick={e => { e.stopPropagation(); toggleExpand(row.id); }}>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      )}
                      {columns.map(col => {
                        const isEditing = editingCell?.rowId === row.id && editingCell?.key === col.key;
                        const value = row[col.key];

                        if (isEditing && col.editable) {
                          if (col.type === 'select') {
                            return (
                              <td key={col.key} className="px-4 py-2" onClick={e => e.stopPropagation()}>
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
                            <td key={col.key} className="px-4 py-2" onClick={e => e.stopPropagation()}>
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
                            onClick={col.editable ? (e) => { e.stopPropagation(); startEdit(row.id, col.key, value); } : undefined}
                          >
                            {col.render ? col.render(value, row) : (value ?? '—')}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Expansion panel — rendered as a sibling <tr> */}
                    {isExpanded && (
                      <tr key={`${row.id}-expanded`} className="bg-gray-50 border-t-0">
                        <td colSpan={columns.length + 1} className="px-4 pb-4 pt-0">
                          <div className="ml-5 border-l-2 border-gray-200 pl-4">
                            {expandRender(row)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{sorted.length} of {data.length} rows</p>
    </div>
  );
}
