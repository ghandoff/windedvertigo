import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { runClaimPrefixBackfill } from '@/lib/claim-backfill';

export const maxDuration = 120;

/**
 * POST /api/admin/backfill/claim-prefixes
 *
 * Scans PCS Claims missing `claimPrefixId` or `coreBenefitId`, runs the
 * LLM-assisted taxonomy extractor, and writes the resolved relations back
 * to Notion.
 *
 * Multi-profile architecture (Week 2) — added 2026-04-19.
 *
 * Query params:
 *   dry_run=true   — preview proposed updates without writing
 *   limit=N        — cap the batch size (useful for first runs)
 */
export async function POST(request) {
  // Wave 7.5 Batch C — schema-edit capability gates this admin backfill.
  // `schema:edit` is super-user-only and re-verifies against Notion.
  const gate = await requireCapability(request, 'schema:edit', { route: '/api/admin/backfill/claim-prefixes' });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : undefined;

  try {
    const results = await runClaimPrefixBackfill({ dryRun, limit });
    return NextResponse.json(results);
  } catch (err) {
    console.error('Claim prefix backfill failed:', err);
    return NextResponse.json(
      { error: 'Backfill failed', message: err.message },
      { status: 500 },
    );
  }
}
