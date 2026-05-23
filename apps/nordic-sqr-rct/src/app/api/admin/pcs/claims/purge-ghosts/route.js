import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pcs/claims/purge-ghosts — RETIRED (Part 10, 2026-05-23)
 *
 * This endpoint identified Postgres pcs_claims rows whose Notion source page
 * had been hard-deleted (called "ghost" rows). With Postgres as the canonical
 * store, this concept is obsolete:
 *
 *   - All deletes now go through the platform's deleteX() lib functions,
 *     which remove the row from Postgres directly.
 *   - No one edits or deletes records directly in Notion — the platform is
 *     the sole editing surface (Part 10 migration, 2026-05-23).
 *   - There is no longer a Notion source to drift from.
 *
 * If you need to remove stale Postgres rows, use a direct Supabase query.
 */
export async function POST() {
  return NextResponse.json(
    {
      retired: true,
      message: 'purge-ghosts retired — Postgres is the source of truth as of Part 10 migration (2026-05-23). No Notion source to compare against. Use Supabase dashboard for direct data cleanup if needed.',
    },
    { status: 410 },
  );
}
