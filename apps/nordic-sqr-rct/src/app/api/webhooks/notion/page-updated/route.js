import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/notion/page-updated — RETIRED (Part 10, 2026-05-23)
 *
 * This webhook mirrored Notion edits into Postgres in real time.
 * It is no longer needed because:
 *   1. Notion is no longer an editing surface — no one edits data
 *      directly in Notion. The Nordic Research Platform is the sole
 *      write path for all PCS and SQR data.
 *   2. All writes go Postgres-first (PCS_WRITE_TO_POSTGRES=1). Postgres
 *      is the source of truth; nothing needs to be synced from Notion.
 *
 * ACTION REQUIRED: Unregister this webhook in Notion's integration
 * settings to prevent Notion from repeatedly retrying calls here.
 *
 * Returns 410 Gone so Notion sees a permanent failure and stops retrying.
 */
export async function POST() {
  return NextResponse.json(
    {
      retired: true,
      message: 'Notion webhook retired — all writes are Postgres-first as of Part 10 migration (2026-05-23). Please unregister this webhook in Notion integration settings.',
    },
    { status: 410 },
  );
}
