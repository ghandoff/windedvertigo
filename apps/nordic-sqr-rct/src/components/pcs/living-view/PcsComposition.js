'use client';

import { useMemo, useState } from 'react';

/**
 * PcsComposition — Table 2 (Product Composition) for the Living PCS View.
 *
 * Dense data table (7 columns):
 *   AI · AI Form · Amount/Serving · Unit · %DV · FM PLM# · Ingredient Source
 *
 * Sortable by AI name. Other columns render in the order they arrive.
 */
export default function PcsComposition({ formulaLines }) {
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

  if (rows.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          No formula lines recorded. Upload a PCS PDF to extract composition data.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(line => (
            <tr key={line.id}>
              <Td className="font-medium">
                {line.ai || line.ingredientForm || '—'}
              </Td>
              <Td>{line.aiForm || '—'}</Td>
              <Td className="text-right font-mono text-xs">
                {line.amountPerServing ?? '—'}
              </Td>
              <Td>{line.amountUnit || '—'}</Td>
              <Td className="text-right font-mono text-xs">
                {line.percentDailyValue != null ? `${line.percentDailyValue}%` : '—'}
              </Td>
              <Td className="font-mono text-xs">
                {line.fmPlm || <span className="text-amber-600">—</span>}
              </Td>
              <Td className="text-xs text-gray-600">
                {line.ingredientSource || '—'}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${className}`}
    >
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
