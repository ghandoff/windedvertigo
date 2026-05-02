import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getUntaggedEvidence, updateEvidence } from '@/lib/pcs-evidence';
import { detectIngredients } from '@/lib/ingredients';

export const maxDuration = 120;

/**
 * POST /api/admin/backfill/ingredients
 *
 * Scans Evidence Library entries that have no Ingredient tag, runs keyword
 * detection against Name / Citation / Canonical research summary, and
 * writes matched ingredients back to Notion.
 *
 * Query params:
 *   dry_run=true  — preview matches without writing
 */
export async function POST(request) {
  // Wave 7.5 Batch C — ingredient tagging is taxonomy curation.
  const gate = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/admin/backfill/ingredients' });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';

  const results = {
    tagged: [],
    noMatch: [],
    errors: [],
  };

  try {
    // ── Fetch untagged entries ───────────────────────────────────────
    const entries = await getUntaggedEvidence();

    // ── Run keyword detection ───────────────────────────────────────
    for (const entry of entries) {
      const ingredients = detectIngredients({
        name: entry.name,
        citation: entry.citation,
        summary: entry.canonicalSummary,
      });

      if (ingredients.length === 0) {
        results.noMatch.push({
          id: entry.id,
          name: entry.name,
        });
        continue;
      }

      results.tagged.push({
        id: entry.id,
        name: entry.name,
        ingredients,
      });

      if (!dryRun) {
        try {
          await updateEvidence(entry.id, { ingredient: ingredients });
          // rate limit: 350ms between writes
          await new Promise(r => setTimeout(r, 350));
        } catch (err) {
          results.errors.push({ id: entry.id, name: entry.name, error: err.message });
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalUntagged: entries.length,
        tagged: results.tagged.length,
        noMatch: results.noMatch.length,
        errors: results.errors.length,
        dryRun,
      },
      details: {
        tagged: results.tagged,
        noMatch: results.noMatch,
        errors: results.errors,
      },
    });
  } catch (err) {
    console.error('Ingredient backfill failed:', err);
    return NextResponse.json(
      { error: 'Backfill failed', message: err.message },
      { status: 500 },
    );
  }
}
