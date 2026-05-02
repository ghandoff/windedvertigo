'use client';

/**
 * PcsCoverSection — Cover / Header section for the Living PCS View.
 *
 * Renders PCS ID, product (finishedGoodName) name, format badge, approvedDate,
 * and a TemplateVersionChip derived from `doc.templateVersion`.
 */
function TemplateVersionChip({ templateVersion }) {
  if (!templateVersion) return null;
  const styles = {
    'Lauren v1.0': 'bg-pacific-50 text-pacific-700 border-pacific-200',
    'Lauren v1.0 partial': 'bg-amber-50 text-amber-700 border-amber-200',
    'Legacy pre-Lauren': 'bg-red-50 text-red-700 border-red-200',
    Unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const cls = styles[templateVersion] || styles.Unknown;
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${cls}`}>
      {templateVersion}
    </span>
  );
}

export default function PcsCoverSection({ doc, version }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            PCS ID
          </p>
          <p className="text-2xl font-bold text-gray-900">{doc.pcsId || '—'}</p>
          {(doc.finishedGoodName || version?.productName) && (
            <p className="text-base text-gray-700">
              {doc.finishedGoodName || version?.productName}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.format && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-white border border-gray-200 text-gray-700">
              {doc.format}
            </span>
          )}
          <TemplateVersionChip templateVersion={doc.templateVersion} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-gray-200">
        <div>
          <p className="text-xs text-gray-500 uppercase">Approved date</p>
          <p className="text-sm font-medium text-gray-900">{doc.approvedDate || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Version</p>
          <p className="text-sm font-medium text-gray-900">{version?.version || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">File status</p>
          <p className="text-sm font-medium text-gray-900">{doc.fileStatus || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Product status</p>
          <p className="text-sm font-medium text-gray-900">{doc.productStatus || '—'}</p>
        </div>
      </div>
    </div>
  );
}
