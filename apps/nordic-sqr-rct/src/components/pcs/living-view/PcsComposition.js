'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import InlineField from '@/components/pcs/InlineField';
import { AI_UNITS } from '@/lib/pcs-config';

/**
 * PcsComposition — Table 2 (Product Composition) for the Living PCS View.
 *
 * Part 7B — added inline editing for all formula line fields.
 * Editable columns (all cells use the shared InlineField component):
 *   AI · AI Form · Amount/Serving · Unit (dropdown) · %DV · FM PLM# · Ingredient Source
 *   + Canonical AI link (8th column — ties the row to the canonical ingredients DB)
 *
 * Props:
 *   formulaLines     — array of formula line rows
 *   canEdit          — true when the current user has pcs.taxonomy:edit
 *   allIngredients   — array of canonical ingredient records for the picker
 *   onFormulaLineUpdated(line) — called after a successful field save; parent
 *                                should replace the matching row in its state
 */
export default function PcsComposition({
  formulaLines,
  canEdit = false,
  allIngredients = [],
  onFormulaLineUpdated,
}) {
  const [sortAsc, setSortAsc] = useState(true);
  const rows = Array.isArray(formulaLines) ? formulaLines : [];

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const an = (a.ai || a.ingredientForm || '').toLowerCase();
      const bn = (b.ai || b.ingredientForm || '').toLowerCase();
      if (an < bn) return sortAsc ? -1 : 1;
      if (an > bn) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortAsc]);

  // Build ingredient options for the canonical AI picker once
  const ingredientOptions = useMemo(
    () => allIngredients.map(i => ({ value: i.id, label: i.canonicalName })),
    [allIngredients]
  );

  if (rows.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          No formula lines recorded. Upload a PCS PDF to extract composition data.
        </p>
      </div>
    );
  }

  /** Fires PATCH /api/pcs/formula-lines/[id] for a given fieldPath + value. */
  function makeSaveFn(lineId, fieldPath) {
    return async (value) => {
      const res = await fetch(`/api/pcs/formula-lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldPath, value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      return json;
    };
  }

  return (
    <>
    {/* Mobile — card list (one card per formula line) */}
    <div className="md:hidden space-y-3">
      {sorted.map((line) => (
        <FormulaLineCard
          key={line.id}
          line={line}
          canEdit={canEdit}
          ingredientOptions={ingredientOptions}
          allIngredients={allIngredients}
          makeSaveFn={makeSaveFn}
          onUpdated={onFormulaLineUpdated}
        />
      ))}
    </div>

    {/* Desktop / tablet — classic table */}
    <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <Th>
              <button
                type="button"
                onClick={() => setSortAsc(v => !v)}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                AI
                <span aria-hidden="true" className="text-[10px]">
                  {sortAsc ? '▲' : '▼'}
                </span>
              </button>
            </Th>
            <Th>AI Form</Th>
            <Th className="text-right">Amount / Serving</Th>
            <Th>Unit</Th>
            <Th className="text-right">% Daily Value</Th>
            <Th>FM PLM #</Th>
            <Th>Ingredient Source</Th>
            <Th>
              <span className="flex items-center gap-1">
                Canonical AI
                <span className="text-[10px] text-gray-400" title="Links this formula line to the canonical ingredient database">
                  ⓘ
                </span>
              </span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(line => (
            <FormulaLineRow
              key={line.id}
              line={line}
              canEdit={canEdit}
              ingredientOptions={ingredientOptions}
              allIngredients={allIngredients}
              makeSaveFn={makeSaveFn}
              onUpdated={onFormulaLineUpdated}
            />
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ── Mobile card — same InlineField components, vertical layout ────────────────

function FormulaLineCard({ line, canEdit, ingredientOptions, allIngredients, makeSaveFn, onUpdated }) {
  const [local, setLocal] = useState(line);
  function handleSaved() {
    return (updated) => {
      setLocal(updated);
      if (onUpdated) onUpdated(updated);
    };
  }

  const linkedIngredient = local.activeIngredientCanonicalId
    ? allIngredients.find(i => i.id === local.activeIngredientCanonicalId)
    : null;

  // Each field is a row in the card: label on the left, InlineField on the right.
  // The label/value rows are wider than a typical table cell, which gives the
  // inline-edit popovers room to breathe on a 375px viewport.
  const FieldRow = ({ label, children, hint }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-t border-gray-100">
      <div className="shrink-0 min-w-[88px]">
        <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
        {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <dd className="min-w-0 flex-1 text-right">{children}</dd>
    </div>
  );

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <header className="text-base font-semibold text-gray-900 break-words mb-1">
        <InlineField
          value={local.ai || local.ingredientForm || ''}
          onSave={makeSaveFn(local.id, 'ai')}
          onSaved={handleSaved('ai')}
          canEdit={canEdit}
          fieldName="AI name"
          placeholder="e.g. Vitamin D3"
          displayClassName="text-base font-semibold text-gray-900"
        />
      </header>
      <dl>
        <FieldRow label="AI Form">
          <InlineField
            value={local.aiForm || ''}
            onSave={makeSaveFn(local.id, 'aiForm')}
            onSaved={handleSaved('aiForm')}
            canEdit={canEdit}
            fieldName="AI form"
            placeholder="e.g. cholecalciferol"
            displayClassName="text-sm text-gray-900"
          />
        </FieldRow>
        <FieldRow label="Amount / Serving">
          <InlineField
            value={local.amountPerServing ?? ''}
            onSave={makeSaveFn(local.id, 'amountPerServing')}
            onSaved={handleSaved('amountPerServing')}
            canEdit={canEdit}
            fieldName="amount per serving"
            variant="number"
            displayClassName="text-sm font-mono text-gray-900"
            emptyLabel="—"
          />
        </FieldRow>
        <FieldRow label="Unit">
          <InlineField
            value={local.amountUnit || ''}
            onSave={makeSaveFn(local.id, 'amountUnit')}
            onSaved={handleSaved('amountUnit')}
            canEdit={canEdit}
            fieldName="unit"
            variant="select"
            options={AI_UNITS}
            displayClassName="text-sm text-gray-900"
            emptyLabel="—"
          />
        </FieldRow>
        <FieldRow label="% Daily Value">
          <InlineField
            value={local.percentDailyValue ?? ''}
            onSave={makeSaveFn(local.id, 'percentDailyValue')}
            onSaved={handleSaved('percentDailyValue')}
            canEdit={canEdit}
            fieldName="% daily value"
            variant="number"
            displayClassName="text-sm font-mono text-gray-900"
            emptyLabel="—"
          />
        </FieldRow>
        <FieldRow label="FM PLM #">
          <InlineField
            value={local.fmPlm || ''}
            onSave={makeSaveFn(local.id, 'fmPlm')}
            onSaved={handleSaved('fmPlm')}
            canEdit={canEdit}
            fieldName="FM PLM number"
            displayClassName="text-sm font-mono text-gray-900"
            emptyLabel={<span className="text-amber-600">—</span>}
          />
        </FieldRow>
        <FieldRow label="Source">
          <InlineField
            value={local.ingredientSource || ''}
            onSave={makeSaveFn(local.id, 'ingredientSource')}
            onSaved={handleSaved('ingredientSource')}
            canEdit={canEdit}
            fieldName="ingredient source"
            displayClassName="text-sm text-gray-600"
          />
        </FieldRow>
        <FieldRow label="Canonical AI" hint="Links to ingredient DB">
          {local.activeIngredientCanonicalId ? (
            <Link
              href={`/research/pcs/ingredients/${local.activeIngredientCanonicalId}`}
              className="text-sm text-pacific-600 hover:underline font-medium"
            >
              {linkedIngredient?.canonicalName || '(linked)'}
            </Link>
          ) : (
            <InlineField
              value={local.activeIngredientCanonicalId || ''}
              onSave={async (value) => {
                const res = await fetch(`/api/pcs/formula-lines/${local.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fieldPath: 'activeIngredientCanonicalId', value }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
                return json;
              }}
              onSaved={handleSaved('activeIngredientCanonicalId')}
              canEdit={canEdit && ingredientOptions.length > 0}
              fieldName="canonical ingredient"
              variant="select"
              options={ingredientOptions}
              emptyLabel={<span className="text-amber-600 text-xs font-medium">⚠ unlinked</span>}
              displayClassName="text-sm text-amber-700 font-medium"
            />
          )}
        </FieldRow>
      </dl>
    </article>
  );
}

// ── Row component (keeps per-row InlineField state isolated) ──────────────────

function FormulaLineRow({ line, canEdit, ingredientOptions, allIngredients, makeSaveFn, onUpdated }) {
  // Local optimistic state: start from prop, update on save
  const [local, setLocal] = useState(line);

  function handleSaved(fieldPath) {
    return (updated) => {
      setLocal(updated);
      if (onUpdated) onUpdated(updated);
    };
  }

  const linkedIngredient = local.activeIngredientCanonicalId
    ? allIngredients.find(i => i.id === local.activeIngredientCanonicalId)
    : null;

  return (
    <tr className="hover:bg-gray-50/50">
      {/* AI name */}
      <Td className="font-medium min-w-[120px]">
        <InlineField
          value={local.ai || local.ingredientForm || ''}
          onSave={makeSaveFn(local.id, 'ai')}
          onSaved={handleSaved('ai')}
          canEdit={canEdit}
          fieldName="AI name"
          placeholder="e.g. Vitamin D3"
          displayClassName="text-sm font-medium text-gray-900"
        />
      </Td>

      {/* AI Form */}
      <Td className="min-w-[100px]">
        <InlineField
          value={local.aiForm || ''}
          onSave={makeSaveFn(local.id, 'aiForm')}
          onSaved={handleSaved('aiForm')}
          canEdit={canEdit}
          fieldName="AI form"
          placeholder="e.g. cholecalciferol"
          displayClassName="text-sm text-gray-900"
        />
      </Td>

      {/* Amount per serving */}
      <Td className="text-right min-w-[90px]">
        <InlineField
          value={local.amountPerServing ?? ''}
          onSave={makeSaveFn(local.id, 'amountPerServing')}
          onSaved={handleSaved('amountPerServing')}
          canEdit={canEdit}
          fieldName="amount per serving"
          variant="number"
          displayClassName="text-sm font-mono text-gray-900"
          emptyLabel="—"
        />
      </Td>

      {/* Unit — dropdown */}
      <Td className="min-w-[80px]">
        <InlineField
          value={local.amountUnit || ''}
          onSave={makeSaveFn(local.id, 'amountUnit')}
          onSaved={handleSaved('amountUnit')}
          canEdit={canEdit}
          fieldName="unit"
          variant="select"
          options={AI_UNITS}
          displayClassName="text-sm text-gray-900"
          emptyLabel="—"
        />
      </Td>

      {/* % Daily Value */}
      <Td className="text-right min-w-[80px]">
        <InlineField
          value={local.percentDailyValue ?? ''}
          onSave={makeSaveFn(local.id, 'percentDailyValue')}
          onSaved={handleSaved('percentDailyValue')}
          canEdit={canEdit}
          fieldName="% daily value"
          variant="number"
          displayClassName="text-sm font-mono text-gray-900"
          emptyLabel="—"
        />
      </Td>

      {/* FM PLM # */}
      <Td className="min-w-[90px]">
        <InlineField
          value={local.fmPlm || ''}
          onSave={makeSaveFn(local.id, 'fmPlm')}
          onSaved={handleSaved('fmPlm')}
          canEdit={canEdit}
          fieldName="FM PLM number"
          displayClassName="text-sm font-mono text-gray-900"
          emptyLabel={<span className="text-amber-600">—</span>}
        />
      </Td>

      {/* Ingredient source */}
      <Td className="min-w-[120px]">
        <InlineField
          value={local.ingredientSource || ''}
          onSave={makeSaveFn(local.id, 'ingredientSource')}
          onSaved={handleSaved('ingredientSource')}
          canEdit={canEdit}
          fieldName="ingredient source"
          displayClassName="text-sm text-gray-600"
        />
      </Td>

      {/* Canonical AI — ingredient picker */}
      <Td className="min-w-[160px]">
        {local.activeIngredientCanonicalId ? (
          <div className="flex items-center gap-1.5">
            <Link
              href={`/research/pcs/ingredients/${local.activeIngredientCanonicalId}`}
              className="text-xs text-pacific-600 hover:underline font-medium"
            >
              {linkedIngredient?.canonicalName || '(linked)'}
            </Link>
            {canEdit && (
              <button
                type="button"
                title="Change canonical ingredient"
                className="text-gray-400 hover:text-pacific-600"
                onClick={() => {/* open picker inline — handled below */}}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <InlineField
            value={local.activeIngredientCanonicalId || ''}
            onSave={async (value) => {
              const res = await fetch(`/api/pcs/formula-lines/${local.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fieldPath: 'activeIngredientCanonicalId', value }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
              return json;
            }}
            onSaved={handleSaved('activeIngredientCanonicalId')}
            canEdit={canEdit && ingredientOptions.length > 0}
            fieldName="canonical ingredient"
            variant="select"
            options={ingredientOptions}
            emptyLabel={<span className="text-amber-600 text-xs font-medium">⚠ unlinked</span>}
            displayClassName="text-xs text-amber-700 font-medium"
          />
        )}
      </Td>
    </tr>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 text-gray-900 align-top ${className}`}>
      {children}
    </td>
  );
}
