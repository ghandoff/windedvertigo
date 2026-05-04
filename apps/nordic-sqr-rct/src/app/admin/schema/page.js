'use client';

import ComingSoonStub from '@/components/ComingSoonStub';

/**
 * /admin/schema — Notion + Postgres schema browser (stub).
 */
export default function SchemaStub() {
  return (
    <ComingSoonStub
      category="Admin"
      title="Schema Browser"
      oneLine="Live view of the Notion database properties + Supabase Postgres tables with their column types, RLS policies, and migration history."
      status="In the retainer roadmap (schema-introspection tier)."
      expectedShip="Q3 2026 (retainer Priority tier)"
      whatExistsToday={[
        'Notion API surface returns full schema via the windedvertigo.com integration.',
        'Postgres migrations 001–004 applied to wv-nordic; pgaudit + RLS available per the Data Security T&C v2.',
        'Authoritative property names hardcoded in src/lib/pcs-config.js (PROPS map + database IDs with inline comments).',
      ]}
      backHref="/admin"
      backLabel="Back to Admin"
    />
  );
}
