import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { runIngredientRelationsBackfill } from '@/lib/ingredient-backfill';

export const maxDuration = 120;

const TABLE_ALIASES = {
  formula: 'formula',
  'formula-lines': 'formula',
  evidence: 'evidence',
  'evidence-library': 'evidence',
  claims: 'claims',
  'claim-dose-reqs': 'claims',
};

/**
 * POST /api/admin/backfill/ingredient-relations
 *
 * Fuzzy-matches existing ingredient text on Formula Lines, Evidence
 * Library, and Claim Dose Requirements rows against the canonical
 * Active Ingredients + Active Ingredient Forms databases, and writes
 * the matched IDs back to the new canonical relation columns.
 *
 * Query params:
 *   dry_run=true        — preview matches without writing
 *   table=formula|evidence|claims  — restrict to a single table (default: all 3)
 *   limit=N             — process at most N candidate rows per table
 */
export async function POST(request) {
  // Wave 7.5 Batch C — ingredient-relation linking is taxonomy curation.
  const gate = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/admin/backfill/ingredient-relations' });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';
  const limitStr = searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : null;
  const tableParam = searchParams.get('table');

  let tables = ['formula', 'evidence', 'claims'];
  if (tableParam) {
    const t = TABLE_ALIASES[tableParam.toLowerCase()];
    if (!t) {
      return NextResponse.json(
        { error: `Unknown table "${tableParam}". Use formula | evidence | claims.` },
        { status: 400 },
      );
    }
    tables = [t];
  }

  try {
    const result = await runIngredientRelationsBackfill({ tables, dryRun, limit });

    // Trim per-table sample arrays to keep the response small
    const trimSamples = (r) => {
      if (!r) return null;
      return {
        totalScanned: r.totalScanned,
        alreadyTagged: r.alreadyTagged,
        processed: r.processed,
        matchedCount: r.matched.length,
        noMatchCount: r.noMatch.length,
        errorCount: r.errors.length,
        sampleMatched: r.matched.slice(0, 20),
        sampleNoMatch: r.noMatch.slice(0, 20),
        errors: r.errors,
      };
    };

    return NextResponse.json({
      summary: {
        dryRun,
        limit,
        tables,
        canonical: result.canonical,
      },
      formula: trimSamples(result.formula),
      evidence: trimSamples(result.evidence),
      claims: trimSamples(result.claims),
    });
  } catch (err) {
    console.error('Ingredient relations backfill failed:', err);
    return NextResponse.json(
      { error: 'Backfill failed', message: err.message },
      { status: 500 },
    );
  }
}
