'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import PcsTable from '@/components/pcs/PcsTable';
import InlineField from '@/components/pcs/InlineField';
import { AI_CATEGORIES, AI_UNITS } from '@/lib/pcs-config';

/**
 * Active Ingredients list view.
 *
 * Phase 1 of the Ingredients canonicalization. Each row is a canonical AI
 * ("Vitamin D3", "Magnesium") — the seed of the future migration that will
 * replace the denormalized text in Evidence Library / Formula Lines / Claim
 * Dose Requirements with these relations.
 */
export default function IngredientsPage() {
  const { user } = useAuth();
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  const [ingredients, setIngredients] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  // Duplicate review panel state
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [dismissedPairs, setDismissedPairs] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('pcs-dismissed-dup-pairs') || '[]'));
    } catch { return new Set(); }
  });

  // Fetch-on-mount: async data load that ends in setState for ingredients
  // + forms. Same canonical async-effect pattern as elsewhere in PCS.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch('/api/pcs/ingredients').then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load ingredients'))),
      fetch('/api/pcs/ingredient-forms').then(r => r.ok ? r.json() : []),
    ])
      .then(([ings, fms]) => {
        if (cancelled) return;
        setIngredients(Array.isArray(ings) ? ings : []);
        setForms(Array.isArray(fms) ? fms : []);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Replace one ingredient in the list after an inline save. */
  const handleIngredientUpdated = useCallback((updated) => {
    setIngredients(prev => prev.map(i => i.id === updated.id ? updated : i));
  }, []);

  /** Returns a PATCH save function for a given ingredient id and field path. */
  function makeSaveFn(ingredientId, fieldPath) {
    return async (value) => {
      const res = await fetch(`/api/pcs/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldPath]: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      handleIngredientUpdated(json);
      return json;
    };
  }

  // Forms count per ingredient (computed client-side from the forms list).
  const formCountByIngredient = useMemo(() => {
    const m = {};
    for (const f of forms) {
      if (f.activeIngredientId) m[f.activeIngredientId] = (m[f.activeIngredientId] || 0) + 1;
    }
    return m;
  }, [forms]);

  const filtered = useMemo(() => {
    return ingredients
      .map(i => ({ ...i, formCount: formCountByIngredient[i.id] || 0 }))
      .filter(i => !category || i.category === category)
      .filter(i => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (i.canonicalName || '').toLowerCase().includes(q) ||
          (i.synonyms || '').toLowerCase().includes(q)
        );
      });
  }, [ingredients, formCountByIngredient, category, search]);

  // Columns depend on canWrite + handleIngredientUpdated so we useMemo to
  // avoid recomputing on every render.
  const columns = useMemo(() => [
    {
      key: 'canonicalName',
      label: 'Canonical name',
      render: (val, row) => (
        <Link href={`/research/pcs/ingredients/${row.id}`} className="text-pacific-600 hover:underline font-medium">
          {val || '(untitled)'}
        </Link>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val, row) => (
        <InlineField
          value={val || ''}
          onSave={makeSaveFn(row.id, 'category')}
          canEdit={canWrite}
          fieldName="category"
          variant="select"
          options={AI_CATEGORIES}
          displayClassName="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
          emptyLabel={<span className="text-gray-400">—</span>}
        />
      ),
    },
    {
      key: 'formCount',
      label: 'Forms',
      render: (val) => (
        <span className="text-xs text-gray-600">{val} form{val === 1 ? '' : 's'}</span>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canWrite]);

  async function loadDuplicates() {
    setDuplicatesLoading(true);
    try {
      const res = await fetch('/api/pcs/ingredients/duplicates?threshold=0.5');
      const json = res.ok ? await res.json() : { pairs: [] };
      setDuplicates(json.pairs || []);
    } catch {
      setDuplicates([]);
    } finally {
      setDuplicatesLoading(false);
    }
  }

  function toggleDuplicates() {
    if (!showDuplicates && duplicates === null) {
      loadDuplicates();
    }
    setShowDuplicates(v => !v);
  }

  function dismissPair(a, b) {
    const key = [a, b].sort().join('::');
    setDismissedPairs(prev => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem('pcs-dismissed-dup-pairs', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  async function mergeIngredients(keepId, absorbId, absorbName) {
    // 1. Add absorbName to keepId's synonyms.
    const keepIng = ingredients.find(i => i.id === keepId);
    const existingSynonyms = keepIng?.synonyms ? keepIng.synonyms.trim() : '';
    const newSynonyms = existingSynonyms
      ? `${existingSynonyms}, ${absorbName}`
      : absorbName;

    const patchRes = await fetch(`/api/pcs/ingredients/${keepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synonyms: newSynonyms }),
    });
    if (patchRes.ok) {
      const json = await patchRes.json().catch(() => ({}));
      handleIngredientUpdated(json);
    }

    // 2. Archive the absorbed ingredient via DELETE (archives the Notion page + removes Postgres row).
    const deleteRes = await fetch(`/api/pcs/ingredients/${absorbId}`, { method: 'DELETE' });
    if (deleteRes.ok) {
      setIngredients(prev => prev.filter(i => i.id !== absorbId));
    }
    dismissPair(keepId, absorbId);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Active Ingredients</h1>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  const visibleDups = duplicates
    ? duplicates.filter(p => !dismissedPairs.has([p.ingredientA.id, p.ingredientB.id].sort().join('::')))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Active Ingredients</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Canonical AI catalog. Replaces the denormalized ingredient text scattered across Evidence Library, Formula Lines, and Claim Dose Requirements. Each AI may have multiple chemical/strain Forms (e.g. Magnesium → glycinate, citrate, oxide).
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={toggleDuplicates}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              showDuplicates
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-gray-300 text-gray-600 hover:border-amber-300 hover:text-amber-700'
            }`}
          >
            <span>🔍</span>
            Review Duplicates
            {duplicates !== null && visibleDups.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900">
                {visibleDups.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Duplicate review panel */}
      {showDuplicates && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-900">Duplicate Ingredient Review</h2>
            <button type="button" onClick={() => loadDuplicates()} className="text-xs text-amber-700 hover:underline">
              Refresh
            </button>
          </div>
          {duplicatesLoading ? (
            <div className="text-sm text-amber-700 animate-pulse">Scanning for near-duplicate names…</div>
          ) : visibleDups.length === 0 ? (
            <div className="text-sm text-amber-700">
              {duplicates?.length > 0
                ? `All ${duplicates.length} candidates have been reviewed. `
                : 'No duplicate candidates found.'}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-amber-700">
                {visibleDups.length} candidate pair{visibleDups.length === 1 ? '' : 's'} detected by token similarity, prefix match, or synonym cross-match. Dismissals are remembered in this browser.
              </p>
              {visibleDups.map(p => (
                <DuplicatePairCard
                  key={`${p.ingredientA.id}::${p.ingredientB.id}`}
                  pair={p}
                  ingredients={ingredients}
                  onDismiss={() => dismissPair(p.ingredientA.id, p.ingredientB.id)}
                  onMerge={mergeIngredients}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or synonyms..."
          className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pacific focus:border-transparent w-64"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pacific focus:border-transparent bg-white"
        >
          <option value="">All categories</option>
          {AI_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {canWrite && (
          <span className="text-xs text-gray-400 italic">Click Category or Unit cells to edit in place.</span>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} of {ingredients.length} shown
        </span>
      </div>

      <PcsTable
        columns={columns}
        data={filtered}
        tableKey="ingredients"
        userId={user?.reviewerId}
        emptyMessage="No ingredients match the current filter."
        defaultSortKey="lastEditedTime"
        defaultSortDir="desc"
        hideFilter
      />
    </div>
  );
}

// ── Duplicate pair card ────────────────────────────────────────────────────────

function DuplicatePairCard({ pair, ingredients, onDismiss, onMerge }) {
  const { ingredientA, ingredientB, score, reason } = pair;
  const [mergeState, setMergeState] = useState(null); // null | 'confirming-ab' | 'confirming-ba' | 'done'
  const [working, setWorking] = useState(false);

  // Count how many formula lines link to each
  const aFormsCount = ingredients.find(i => i.id === ingredientA.id)?.formCount;
  const bFormsCount = ingredients.find(i => i.id === ingredientB.id)?.formCount;

  async function doMerge(keepId, absorbId, absorbName) {
    setWorking(true);
    await onMerge(keepId, absorbId, absorbName);
    setMergeState('done');
    setWorking(false);
  }

  if (mergeState === 'done') return null;

  const pct = Math.round(score * 100);
  const scoreColor = pct >= 80 ? 'text-red-700 bg-red-50' : pct >= 65 ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100';

  return (
    <div className="rounded-md border border-amber-300 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${scoreColor}`}>
            {pct}% similar
          </span>
          <span className="text-xs text-gray-500">{reason}</span>
        </div>
        <button type="button" onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600">
          Keep both (dismiss)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {[{ ing: ingredientA, other: ingredientB }, { ing: ingredientB, other: ingredientA }].map(({ ing, other }) => (
          <div key={ing.id} className="space-y-0.5">
            <Link href={`/research/pcs/ingredients/${ing.id}`} className="font-medium text-pacific-700 hover:underline text-sm">
              {ing.canonicalName}
            </Link>
            {ing.category && (
              <div className="text-xs text-gray-500">{ing.category}</div>
            )}
            {ing.synonyms && (
              <div className="text-xs text-gray-400 truncate" title={ing.synonyms}>
                Synonyms: {ing.synonyms}
              </div>
            )}
          </div>
        ))}
      </div>

      {mergeState === 'confirming-ab' && (
        <div className="rounded bg-amber-100 border border-amber-300 p-2 text-xs text-amber-900 space-y-1">
          <p className="font-medium">Confirm: &quot;{ingredientA.canonicalName}&quot; absorbs &quot;{ingredientB.canonicalName}&quot;</p>
          <p>&quot;{ingredientB.canonicalName}&quot; will be added to {ingredientA.canonicalName}&apos;s synonyms and marked archived. Run the Ingredient Relations backfill after merging to re-link formula lines.</p>
          <div className="flex gap-2 mt-2">
            <button type="button" disabled={working} onClick={() => doMerge(ingredientA.id, ingredientB.id, ingredientB.canonicalName)}
              className="px-2 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
              {working ? 'Merging…' : 'Confirm merge'}
            </button>
            <button type="button" onClick={() => setMergeState(null)} className="px-2 py-1 text-xs text-gray-600 hover:underline">Cancel</button>
          </div>
        </div>
      )}
      {mergeState === 'confirming-ba' && (
        <div className="rounded bg-amber-100 border border-amber-300 p-2 text-xs text-amber-900 space-y-1">
          <p className="font-medium">Confirm: &quot;{ingredientB.canonicalName}&quot; absorbs &quot;{ingredientA.canonicalName}&quot;</p>
          <p>&quot;{ingredientA.canonicalName}&quot; will be added to {ingredientB.canonicalName}&apos;s synonyms and marked archived. Run the Ingredient Relations backfill after merging to re-link formula lines.</p>
          <div className="flex gap-2 mt-2">
            <button type="button" disabled={working} onClick={() => doMerge(ingredientB.id, ingredientA.id, ingredientA.canonicalName)}
              className="px-2 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
              {working ? 'Merging…' : 'Confirm merge'}
            </button>
            <button type="button" onClick={() => setMergeState(null)} className="px-2 py-1 text-xs text-gray-600 hover:underline">Cancel</button>
          </div>
        </div>
      )}
      {!mergeState && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setMergeState('confirming-ab')}
            className="px-2.5 py-1 text-xs font-medium border border-amber-400 text-amber-800 rounded hover:bg-amber-50">
            Merge: {ingredientA.canonicalName.slice(0, 20)} absorbs {ingredientB.canonicalName.slice(0, 20)}
          </button>
          <button type="button" onClick={() => setMergeState('confirming-ba')}
            className="px-2.5 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
            Merge: {ingredientB.canonicalName.slice(0, 20)} absorbs {ingredientA.canonicalName.slice(0, 20)}
          </button>
        </div>
      )}
    </div>
  );
}
