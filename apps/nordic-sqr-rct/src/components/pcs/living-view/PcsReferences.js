'use client';

import Link from 'next/link';

/**
 * PcsReferences — References section. Wave 4.3.3.
 *
 * Numbered list sorted by `pcsReferenceLabel`. Each entry hyperlinks to the
 * linked Evidence row when `evidenceItemId` is present.
 *
 * Props:
 *   references — array of reference rows (pcs-references.js parsePage)
 */
export default function PcsReferences({ references = [] }) {
  if (!references || references.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No references recorded for this version.
      </p>
    );
  }

  const sorted = references.slice().sort((a, b) => {
    return compareLabel(a.pcsReferenceLabel, b.pcsReferenceLabel);
  });

  return (
    <ol className="space-y-1.5 text-sm text-gray-800 list-decimal list-inside">
      {sorted.map(r => {
        const label = r.pcsReferenceLabel || '';
        const text = r.referenceTextAsWritten || r.name || '(untitled reference)';
        return (
          <li key={r.id} className="pl-1 marker:text-gray-400">
            {label && (
              <span className="font-mono text-xs text-gray-500 mr-1.5">
                {label}
              </span>
            )}
            {r.evidenceItemId ? (
              <Link
                href={`/pcs/evidence/${r.evidenceItemId}`}
                className="text-pacific-700 hover:underline"
              >
                {text}
              </Link>
            ) : (
              <span>{text}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Natural sort on label so "[2]" comes before "[10]".
function compareLabel(a, b) {
  const na = extractNumber(a);
  const nb = extractNumber(b);
  if (na != null && nb != null && na !== nb) return na - nb;
  return String(a || '').localeCompare(String(b || ''));
}

function extractNumber(label) {
  if (!label) return null;
  const m = String(label).match(/\d+/);
  return m ? Number(m[0]) : null;
}
