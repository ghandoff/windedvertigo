'use client';

/**
 * PcsRevisionTable — Table A (Revision History) for the Living PCS View.
 *
 * Columns: Activity Type, Responsible Dept, Responsible Individual,
 * Start Date, End Date. Approver columns are appended when any row carries
 * approver metadata (Lauren's template dual-approval additions).
 */
export default function PcsRevisionTable({ revisionEvents }) {
  const rows = Array.isArray(revisionEvents) ? revisionEvents : [];

  if (rows.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          No revision events recorded for this version.
        </p>
      </div>
    );
  }

  const showApproverCols = rows.some(
    r => r.approverAlias || r.approverDepartment
  );

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
