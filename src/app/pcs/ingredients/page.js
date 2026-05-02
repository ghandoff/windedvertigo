'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import PcsTable from '@/components/pcs/PcsTable';
import { AI_CATEGORIES } from '@/lib/pcs-config';

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
  const [ingredients, setIngredients] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

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

  const columns = [
    {
      key: 'canonicalName',
      label: 'Canonical name',
      render: (val, row) => (
        <Link href={`/pcs/ingredients/${row.id}`} className="text-pacific-600 hover:underline font-medium">
          {val || '(untitled)'}
        </Link>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => val ? (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {val}
        </span>
      ) : '—',
    },
    {
      key: 'standardUnit',
      label: 'Standard unit',
      render: (val) => val || '—',
    },
    {
      key: 'formCount',
      label: 'Forms',
      render: (val) => (
        <span className="text-xs text-gray-600">{val} form{val === 1 ? '' : 's'}</span>
      ),
    },
    {
      key: 'synonyms',
      label: 'Synonyms',
      render: (val) => val ? (
        <span className="text-xs text-gray-500 truncate max-w-[260px] inline-block" title={val}>{val}</span>
      ) : '—',
    },
  ];

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Active Ingredients</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Canonical AI catalog. Replaces the denormalized ingredient text scattered across Evidence Library, Formula Lines, and Claim Dose Requirements. Each AI may have multiple chemical/strain Forms (e.g. Magnesium → glycinate, citrate, oxide).
        </p>
      </div>

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
      />
    </div>
  );
}
