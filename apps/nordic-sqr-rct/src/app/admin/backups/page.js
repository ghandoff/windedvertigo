'use client';

import ComingSoonStub from '@/components/ComingSoonStub';

/**
 * /admin/backups — snapshot recovery + verification UI (stub).
 *
 * Aligned with Data Security T&C v2 §5.5 (off-platform daily snapshot).
 */
export default function BackupsStub() {
  return (
    <ComingSoonStub
      category="Admin"
      title="Backups & Recovery"
      oneLine="Operator console for snapshot status, restore rehearsals, and off-platform backup verification — aligned with the Data Security T&C v2 §5.5 commitment."
      status="In the retainer roadmap (Phase N5 — Supabase migration cutover prereq)."
      expectedShip="Q4 2026 (after Phase N2 Notion → Supabase backfill)"
      whatExistsToday={[
        'Notion native version history (PCS pages, AICS pages, claim mutations).',
        'Supabase wv-nordic project — point-in-time recovery configurable on the Pro tier (currently Free; upgrade is part of Phase N4).',
        'Quarterly snapshot recovery rehearsal commitment in T&C v2 §5.5.',
      ]}
      backHref="/admin"
      backLabel="Back to Admin"
    />
  );
}
