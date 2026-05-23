import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/drift-sync — RETIRED (Part 10, 2026-05-23)
 *
 * This route existed to sync Notion edits into Postgres as a safety net.
 * It is no longer needed because:
 *   1. All writes go Postgres-first (PCS_WRITE_TO_POSTGRES=1).
 *   2. Notion is no longer an editing surface — the platform is the
 *      sole write path.
 *   3. There is nothing to drift-sync: Postgres IS the canonical store.
 *
 * The cron expression (every-2-min) still fires process-imports; drift-sync
 * has been removed from the ROUTES array in src/lib/scheduled.js.
 *
 * Returns 410 Gone so any accidental direct call is immediately visible.
 */
export async function GET() {
  return NextResponse.json(
    {
      retired: true,
      message: 'drift-sync retired — Postgres is now the canonical store (Part 10 migration, 2026-05-23). All writes go Postgres-first. Nothing to sync from Notion.',
    },
    { status: 410 },
  );
}
