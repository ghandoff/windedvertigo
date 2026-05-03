'use client';

/**
 * /pcs/claims/new — Bundle 4 Phase 1
 *
 * Two entry surfaces side-by-side:
 *   1. Form-driven entry (NEW) — controlled-vocab dropdowns, form scaffold only.
 *      Submit logs the payload; persistence lands in Phase 4.2.
 *   2. Upload .docx (EXISTING fallback) — links into the data-hub imports tab,
 *      which is the current production path for adding claims.
 *
 * The Upload tab is the default to avoid disrupting the production flow until
 * Phase 4.2 wires the form-driven path through to a real backend.
 */

import { useState } from 'react';
import Link from 'next/link';
import PcsClaimFormFields from '@/components/pcs/forms/PcsClaimFormFields';

const TAB_FORM = 'form';
const TAB_UPLOAD = 'upload';

export default function NewPcsClaimPage() {
  const [tab, setTab] = useState(TAB_UPLOAD);
  const [lastSubmitted, setLastSubmitted] = useState(null);

  function handleFormSubmit(payload) {
    // Phase 4.2: POST to a future /api/pcs/claims endpoint that consumes
    // this controlled-vocab payload. For now the parent page is just a
    // preview surface for Lauren — log + reflect in UI.
    console.log('[PcsClaimFormFields] submit payload:', payload);
    setLastSubmitted(payload);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New PCS claim</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a claim either by uploading a .docx (the current production path)
          or by entering it directly with controlled-vocabulary dropdowns
          (preview — Phase 4.2 wires submit through).
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setTab(TAB_UPLOAD)}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              tab === TAB_UPLOAD
                ? 'border-pacific-500 text-pacific-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
            aria-current={tab === TAB_UPLOAD ? 'page' : undefined}
          >
            Upload .docx
          </button>
          <button
            type="button"
            onClick={() => setTab(TAB_FORM)}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              tab === TAB_FORM
                ? 'border-pacific-500 text-pacific-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
            aria-current={tab === TAB_FORM ? 'page' : undefined}
          >
            Form-driven entry <span className="ml-1 rounded bg-yellow-100 px-1 py-0.5 text-[10px] font-medium text-yellow-800">preview</span>
          </button>
        </nav>
      </div>

      {tab === TAB_UPLOAD && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            Document upload lives in the Data Hub imports tab. Use the link below to upload a PCS .docx; claims are extracted and committed there.
          </p>
          <Link
            href="/pcs/data?tab=imports"
            className="mt-3 inline-block rounded-md bg-pacific-600 px-4 py-2 text-sm font-medium text-white hover:bg-pacific-700"
          >
            Go to Imports
          </Link>
        </div>
      )}

      {tab === TAB_FORM && (
        <div className="space-y-4">
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
            Preview only — Submit logs the payload to the browser console. Phase 4.2 wires this to actual claim creation.
          </div>
          <PcsClaimFormFields onSubmit={handleFormSubmit} />
          {lastSubmitted && (
            <details className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-gray-700">Last submitted payload</summary>
              <pre className="mt-2 overflow-x-auto text-[11px] text-gray-700">
{JSON.stringify(lastSubmitted, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
