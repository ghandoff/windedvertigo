'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

/**
 * Active Ingredient detail page.
 *
 * Sections:
 *   - Header (canonical name + category + standard unit)
 *   - Synonyms + notes
 *   - FDA RDI / regulatory ceiling / bioavailability / interaction cautions
 *   - Forms table (chemical/strain expressions of this AI)
 *
 * TODO: rollup counts of Evidence items / Formula Lines / Claim Dose Reqs
 *       linked via the new canonical relations. Skipped this round —
 *       relations start empty and a separate query layer will be added
 *       once the migration script populates them.
 */
export default function IngredientDetailPage({ params }) {
  const { id } = use(params);
  const { user } = useAuth(); // reserved for future inline edits
  void user;

  const [ingredient, setIngredient] = useState(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ingRes, formRes] = await Promise.all([
        fetch(`/api/pcs/ingredients/${id}`),
        fetch(`/api/pcs/ingredient-forms?ingredientId=${id}`),
      ]);
      if (!ingRes.ok) throw new Error('Could not load ingredient');
      const ing = await ingRes.json();
      setIngredient(ing);
      const fm = formRes.ok ? await formRes.json() : [];
      setForms(Array.isArray(fm) ? fm : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
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

  if (!ingredient) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/pcs/ingredients" className="hover:underline">Ingredients</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{ingredient.canonicalName || 'Untitled'}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{ingredient.canonicalName || 'Untitled'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          {ingredient.category && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {ingredient.category}
            </span>
          )}
          {ingredient.standardUnit && (
            <span className="text-xs text-gray-500">
              Standard unit: <span className="font-medium text-gray-700">{ingredient.standardUnit}</span>
            </span>
          )}
        </div>
      </div>

      {/* Synonyms + general notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500 mb-1">Synonyms</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {ingredient.synonyms || <span className="text-gray-400">— None recorded —</span>}
          </p>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500 mb-1">Notes</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {ingredient.notes || <span className="text-gray-400">— None —</span>}
          </p>
        </div>
      </div>

      {/* Regulatory + bioavailability */}
      <div className="card p-4 space-y-4">
        <div className="text-xs uppercase text-gray-500 font-medium">Regulatory & bioavailability</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">FDA RDI</div>
            <div className="font-medium text-gray-800">
              {ingredient.fdaRdi != null ? `${ingredient.fdaRdi} ${ingredient.fdaRdiUnit || ''}`.trim() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Regulatory ceiling</div>
            <div className="font-medium text-gray-800">
              {ingredient.regulatoryCeiling != null ? `${ingredient.regulatoryCeiling} ${ingredient.standardUnit || ''}`.trim() : '—'}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">Bioavailability notes</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {ingredient.bioavailabilityNotes || <span className="text-gray-400">— None —</span>}
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">Interaction cautions</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {ingredient.interactionCautions || <span className="text-gray-400">— None —</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Forms table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Forms</h2>
            <p className="text-xs text-gray-500">
              Chemical or strain-level expressions of this AI ({forms.length} total)
            </p>
          </div>
        </div>
        {forms.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No forms recorded for this ingredient yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Form name</th>
                <th className="px-4 py-2 text-left font-medium">Synonyms</th>
                <th className="px-4 py-2 text-left font-medium">Strain ID</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-left font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(f => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{f.formName || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.synonyms || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.strainIdentifier || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.source || '—'}</td>
                  <td className="px-4 py-2">
                    {f.isDefault ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Default</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
