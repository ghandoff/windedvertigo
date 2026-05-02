'use client';

/**
 * Wave 6.0 — PCS Data Hub.
 *
 * Collapses the former /pcs/admin/imports, /pcs/admin/labels/imports, and
 * /pcs/export top-level nav entries into a single tabbed hub. Tab selection
 * is driven by ?tab= in the URL so bookmarks + deep links are shareable.
 *
 *   /pcs/data              → Imports (default)
 *   /pcs/data?tab=imports  → Imports
 *   /pcs/data?tab=labels   → Label Imports
 *   /pcs/data?tab=export   → Export
 *
 * Role gating:
 *   - pcs / admin: all three tabs usable.
 *   - pcs-readonly: Export tab usable; Imports + Label Imports tabs render
 *     a disabled placeholder explaining that write access is required.
 *
 * Legacy routes (/pcs/admin/imports etc.) still exist as redirect shims
 * pointing here; see adjacent `page.js` files.
 */

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import ImportsPanel from '@/components/pcs/data-hub/ImportsPanel';
import LabelsImportsPanel from '@/components/pcs/data-hub/LabelsImportsPanel';
import ExportPanel from '@/components/pcs/data-hub/ExportPanel';

const TABS = [
  { key: 'imports', label: 'PCS Imports',   writeOnly: true  },
  { key: 'labels',  label: 'Label Imports', writeOnly: true  },
  { key: 'export',  label: 'Export',        writeOnly: false },
];

// Wave 7.0.2 — centralized via `hasAnyRole`. Client gate is a UX hint;
// server routes inside each panel re-verify via authenticatePcsWrite.
const hasPcsWriteAccess = (user) => hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

export default function PcsDataHubPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500">Loading…</div>}>
      <DataHub />
    </Suspense>
  );
}

function DataHub() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const activeTab = useMemo(() => {
    const t = searchParams.get('tab');
    return TABS.some(x => x.key === t) ? t : 'imports';
  }, [searchParams]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  const canWrite = hasPcsWriteAccess(user);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Tab strip — pacific-600 tokens to match claim-detail + existing pages */}
      <div
        role="tablist"
        aria-label="Data hub sections"
        className="flex flex-col md:flex-row md:items-center md:border-b md:border-gray-200 gap-1 md:gap-0"
      >
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          const href = `/pcs/data?tab=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'px-4 py-2 text-sm transition-colors',
                'md:border-b-2 md:-mb-px',
                isActive
                  ? 'border-pacific-600 text-pacific-700 font-medium md:border-b-2'
                  : 'border-transparent text-gray-600 hover:text-pacific-700',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === 'imports' && (
          canWrite ? <ImportsPanel /> : <NoWriteAccessPlaceholder what="Imports" />
        )}
        {activeTab === 'labels' && (
          canWrite ? <LabelsImportsPanel /> : <NoWriteAccessPlaceholder what="Label Imports" />
        )}
        {activeTab === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}

function NoWriteAccessPlaceholder({ what }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
      <h2 className="text-lg font-medium text-gray-900">{what} — write access required</h2>
      <p className="mt-2 text-sm text-gray-600">
        Your account is read-only. Contact your admin if you need to run {what.toLowerCase()}.
      </p>
    </div>
  );
}
