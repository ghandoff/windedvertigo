import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllEvidenceEntries } from '@/lib/pcs';
import { enrichArticle } from '@/lib/pcs-enrichment';
import { normalizeDoi } from '@/lib/doi';
import { updateEvidence } from '@/lib/pcs-evidence';

export const maxDuration = 300;

/**
 * POST /api/admin/enrich
 *
 * Scans PCS Evidence Library for entries with incomplete metadata (missing
 * summary, ingredients, PMID, or year), fetches from PubMed, generates
 * Claude summaries, and runs context-aware ingredient detection.
 *
 * Only enriches entries that have a DOI or PMID to look up.
 *
 * Query params:
 *   dry_run=true  — preview enrichments without writing
 *   max=N         — process at most N entries per run (default 15, max 50)
 */
export async function POST(request) {
  // Wave 7.5 Batch C — enrichment is the canonical evidence-enrich surface.
  const gate = await requireCapability(request, 'pcs.evidence:enrich', { route: '/api/admin/enrich' });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';
  const maxItems = Math.min(parseInt(searchParams.get('max') || '15', 10) || 15, 50);

  const results = { enriched: [], skipped: [], errors: [] };

  try {
    const entries = await getAllEvidenceEntries();

    // Find entries that need enrichment: have DOI or PMID but missing metadata
    const allNeedsEnrich = entries.filter(e => {
      const hasDoi = !!normalizeDoi(e.doi);
      const hasPmid = !!e.pmid;
      if (!hasDoi && !hasPmid) return false; // can't look up without identifier

      const missingSummary = !e.summary;
      const missingIngredients = !e.ingredients || e.ingredients.length === 0;
      const missingYear = !e.publicationYear;
      const missingPmid = !e.pmid;

      return missingSummary || missingIngredients || missingYear || missingPmid;
    });

    // Process at most maxItems to stay within timeout
    const needsEnrich = allNeedsEnrich.slice(0, maxItems);
    const remaining = allNeedsEnrich.length - needsEnrich.length;

    for (const entry of needsEnrich) {
      try {
        const enriched = await enrichArticle({
          doi: normalizeDoi(entry.doi),
          pmid: entry.pmid || null,
          title: entry.name,
          pdfUrl: entry.pdf || null,
        });

        if (!enriched.enriched) {
          results.skipped.push({
            id: entry.id,
            name: entry.name,
            reason: enriched.reason,
          });
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        // Determine what to update
        const updates = {};
        const changes = [];

        if (!entry.summary && enriched.summary) {
          updates.canonicalSummary = enriched.summary;
          changes.push('summary');
        }

        if ((!entry.ingredients || entry.ingredients.length === 0) && enriched.ingredients.length > 0) {
          updates.ingredient = enriched.ingredients;
          changes.push(`ingredients: ${enriched.ingredients.join(', ')}`);
        }

        if (!entry.publicationYear && enriched.year) {
          updates.publicationYear = parseInt(enriched.year);
          changes.push(`year: ${enriched.year}`);
        }

        if (!entry.pmid && enriched.pmid) {
          updates.pmid = enriched.pmid;
          changes.push(`pmid: ${enriched.pmid}`);
        }

        const item = {
          id: entry.id,
          name: entry.name,
          changes,
          ingredientReasoning: enriched.ingredientReasoning || null,
        };

        if (Object.keys(updates).length > 0 && !dryRun) {
          await updateEvidence(entry.id, updates);
          item.written = true;
        }

        results.enriched.push(item);
      } catch (err) {
        results.errors.push({ id: entry.id, name: entry.name, error: err.message });
      }

      // PubMed rate limit (3 req/sec) + Claude calls
      await new Promise(r => setTimeout(r, 500));
    }

    const totalEntries = entries.length;
    const alreadyComplete = totalEntries - allNeedsEnrich.length;

    return NextResponse.json({
      summary: {
        dryRun,
        totalEntries,
        alreadyComplete,
        needsEnrich: allNeedsEnrich.length,
        processedThisBatch: needsEnrich.length,
        enriched: results.enriched.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        remaining,
      },
      details: results,
    });
  } catch (err) {
    console.error('Enrichment failed:', err);
    return NextResponse.json({ error: 'Enrichment failed', message: err.message }, { status: 500 });
  }
}
