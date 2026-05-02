'use client';

/**
 * PcsApplicableProducts — Table B: finishedGoodName, FMT, SAP material no, SKUs.
 *
 * Accepts `doc` and renders a 2-column key-value card + SKU chip row. Renders
 * the empty-state copy when core fields are missing (e.g., legacy documents).
 */
export default function PcsApplicableProducts({ doc }) {
  const hasAnyField =
    doc.finishedGoodName || doc.format || doc.sapMaterialNo || (doc.skus && doc.skus.length > 0);

  if (!hasAnyField) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          Product details not yet recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase">Finished Good Name</p>
          <p className="text-sm font-medium text-gray-900">
            {doc.finishedGoodName || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Format (FMT)</p>
          <p className="text-sm font-medium text-gray-900">{doc.format || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">SAP Material No.</p>
          <p className="text-sm font-mono font-medium text-gray-900">
            {doc.sapMaterialNo || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">SKUs</p>
          {doc.skus?.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {doc.skus.map(sku => (
                <span
                  key={sku}
                  className="px-2 py-0.5 text-xs font-mono bg-white border border-gray-200 rounded"
                >
                  {sku}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
