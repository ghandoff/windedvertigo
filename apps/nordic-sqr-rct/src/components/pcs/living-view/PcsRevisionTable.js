'use client';

import { useState } from 'react';

/**
 * PcsRevisionTable — Table A (Revision History) for the Living PCS View.
 *
 * Columns: Activity Type, Responsible Dept, Responsible Individual,
 * Start Date, End Date. Approver columns are appended when any row carries
 * approver metadata (Lauren's template dual-approval additions).
 *
 * Wave 8 Phase B — adds an "Export CSV" button that GETs
 * /api/pcs/audit-trail/export and triggers a browser download. Capability
 * gate (`audit:read`) is enforced server-side; if the viewer lacks it the
 * fetch returns 403 and we surface a brief inline error.
 */
export default function PcsRevisionTable({ revisionEvents }) {
  const rows = Array.isArray(revisionEvents) ? revisionEvents : [];
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch('/api/pcs/audit-trail/export', {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Export failed (${res.status})${body ? `: ${body.slice(0, 120)}` : ''}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `pcs-audit-trail-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const showApproverCols = rows.some(
    r => r.approverAlias || r.approverDepartment
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-3">
        {exportError ? (
          <span className="text-xs text-red-600" role="alert">{exportError}</span>
        ) : null}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-pacific-600 px-3 py-1.5 text-xs font-medium text-pacific-700 hover:bg-pacific-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">
            No revision events recorded for this version.
          </p>
        </div>
      ) : (
        <RevisionTableInner rows={rows} showApproverCols={showApproverCols} />
      )}
    </div>
  );
}

function RevisionTableInner({ rows, showApproverCols }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <Th>Activity Type</Th>
            <Th>Responsible Dept</Th>
            <Th>Responsible Individual</Th>
            <Th>Start Date</Th>
            <Th>End Date</Th>
            {showApproverCols && (
              <>
                <Th>Approver</Th>
                <Th>Approver Dept</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(ev => (
            <tr key={ev.id}>
              <Td>{ev.activityType || ev.event || '—'}</Td>
              <Td>{ev.responsibleDept || '—'}</Td>
              <Td>{ev.responsibleIndividual || ev.event || '—'}</Td>
              <Td className="font-mono text-xs">{ev.startDate || '—'}</Td>
              <Td className="font-mono text-xs">{ev.endDate || '—'}</Td>
              {showApproverCols && (
                <>
                  <Td>{ev.approverAlias || '—'}</Td>
                  <Td>{ev.approverDepartment || '—'}</Td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
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
