'use client';

import ComingSoonStub from '@/components/ComingSoonStub';

/**
 * /admin/audit — cross-platform audit log explorer (stub).
 */
export default function AuditStub() {
  return (
    <ComingSoonStub
      category="Admin"
      title="Audit Log Explorer"
      oneLine="Searchable, filterable view across SQR-RCT scoring events, PCS claim revisions, AICS reviews, login events, and capability checks."
      status="In the retainer roadmap (audit consolidation tier)."
      expectedShip="Q3 2026 (retainer Priority tier)"
      whatExistsToday={[
        'PCS revisions audit trail with before/after JSON on every claim mutation, exportable to CSV via Wave 8 Phase B.',
        'Email-keyed reviewer-action logging shipped 2026-04-30 (Phase B).',
        'Capability-check telemetry on every gated API route.',
        'Slack notifier on critical events (#nordic-platform-feedback).',
      ]}
      backHref="/admin"
      backLabel="Back to Admin"
    />
  );
}
