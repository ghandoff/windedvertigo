'use client';

/**
 * ReviewStatusBadge — shared display component for review gate status.
 *
 * Pure display: no data fetching. Callers supply the status string
 * (one of GATE_STATUS.*) and optional approval metadata.
 *
 * Usage:
 *   <ReviewStatusBadge status="approved" approvedBy="sharon@..." approvedAt="..." />
 *   <ReviewStatusBadge status="pending_review" />
 */

const STATUS_BADGE = {
  pending_review: {
    label: 'Pending review',
    cls: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  approved: {
    label: 'Approved',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  needs_changes: {
    label: 'Needs changes',
    cls: 'bg-orange-50 text-orange-700 border-orange-100',
  },
  rejected: {
    label: 'Rejected',
    cls: 'bg-red-50 text-red-700 border-red-100',
  },
};

export function ReviewStatusBadge({ status, approvedBy, approvedAt, className = '' }) {
  if (!status) return null;

  const config = STATUS_BADGE[status] ?? {
    label: status,
    cls: 'bg-gray-50 text-gray-600 border-gray-100',
  };

  const isApprovedWithMeta = status === 'approved' && approvedBy;
  const displayText = isApprovedWithMeta
    ? `Approved by ${approvedBy}${approvedAt ? ` · ${new Date(approvedAt).toLocaleDateString()}` : ''}`
    : config.label;

  return (
    <span
      title={displayText}
      className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${config.cls} ${className}`}
    >
      {displayText}
    </span>
  );
}

export default ReviewStatusBadge;
