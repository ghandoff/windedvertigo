import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sync/ingredients — RETIRED (Phase G-1, 2026-05-23)
 *
 * This endpoint force-synced Notion → Postgres for the canonical Ingredients
 * table. With Postgres as the canonical store (Part 10 migration, 2026-05-23),
 * there's nothing to sync FROM — Notion has been retired as a write surface
 * and no one edits ingredients there anymore.
 *
 * The `syncRecentIngredientsToPostgres` helper in pcs-ingredients.js still
 * exists as dead code (zero callers); a future codemod PR will delete it
 * along with the matching helpers across the other 20 lib files.
 */
export async function POST() {
  return NextResponse.json(
    {
      retired: true,
      message: 'admin/sync/ingredients retired — Postgres is the canonical store (Part 10 migration, 2026-05-23). No Notion → Postgres sync needed.',
    },
    { status: 410 },
  );
}
