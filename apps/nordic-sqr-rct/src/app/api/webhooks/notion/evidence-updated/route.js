import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/notion/evidence-updated — RETIRED (Part 10, 2026-05-23)
 *
 * Originally fired by Notion when a Research member checked the
 * Safety signal checkbox on an Evidence row. With Notion no longer being
 * an editing surface, safety-signal flips happen in the platform UI itself,
 * which can invoke ingredientSafetySweep directly without a webhook hop.
 *
 * ACTION REQUIRED: unregister this webhook in Notion integration settings
 * so Notion stops sending events that 410 here.
 */
export async function POST() {
  return NextResponse.json(
    {
      retired: true,
      message: 'Notion evidence-updated webhook retired — safety-signal handling now lives in the platform UI (Part 10 migration, 2026-05-23). Unregister this webhook in Notion integration settings.',
    },
    { status: 410 },
  );
}

// Notion sometimes preflights with GET for the url_verification challenge.
// Reply with the same 410 so it removes the registration.
export async function GET() {
  return NextResponse.json(
    {
      retired: true,
      message: 'Notion evidence-updated webhook retired (Part 10 migration, 2026-05-23).',
    },
    { status: 410 },
  );
}
