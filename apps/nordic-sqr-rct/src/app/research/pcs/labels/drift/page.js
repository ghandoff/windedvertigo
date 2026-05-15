'use client';

import ComingSoonStub from '@/components/ComingSoonStub';

/**
 * /pcs/labels/drift — Wave 5.2 Label Drift Sweep UI (deferred).
 *
 * The sweep cron itself runs nightly today (`/api/cron/sweep-label-drift`).
 * What's missing is the operator-facing dashboard for triaging the drift
 * events the cron records. Tracked under the retainer roadmap.
 */
export default function DriftStub() {
  return (
    <ComingSoonStub
      category="PCS · Labels"
      title="Label Drift Triage"
      oneLine="Operator dashboard for triaging label-vs-PCS drift events surfaced by the nightly sweep cron."
      status="In the retainer roadmap (Wave 5.2 dashboard tier)."
      expectedShip="Q3 2026 (retainer Priority tier)"
      whatExistsToday={[
        'Nightly sweep cron at /api/cron/sweep-label-drift detects when a finished-good label diverges from its parent PCS claims.',
        'Slack notifier (#nordic-platform-feedback) fires when drift is detected.',
        'Audit-trail rows are written to the existing PCS revisions table so RA can reconstruct what changed.',
      ]}
      backHref="/pcs"
    />
  );
}
