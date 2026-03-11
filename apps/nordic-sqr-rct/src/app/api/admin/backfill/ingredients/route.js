import { NextResponse } from 'next/server';
import { authenticateRequest, verifyAdminFromNotion } from '@/lib/auth';
import { getUntaggedEvidence, updateEvidenceIngredients } from '@/lib/pcs';
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
  // ── Auth ──────────────────────────────────────────────────────────
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const isAdmin = await verifyAdminFromNotion(user);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

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
        summary: entry.summary,
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
          await updateEvidenceIngredients(entry.id, ingredients);
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
