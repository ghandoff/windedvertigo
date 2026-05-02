import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getEvidence, updateEvidence } from '@/lib/pcs-evidence';
import { enrichArticle } from '@/lib/pcs-enrichment';
import { normalizeDoi } from '@/lib/doi';

/**
 * POST /api/pcs/evidence/[id]/enrich
 *
 * Enriches a single evidence entry from PubMed + Claude.
 * Fills in missing: summary, ingredients, PMID, year, journal, DOI.
 * Only overwrites fields that are currently empty.
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:enrich', { route: '/api/pcs/evidence/[id]/enrich' });
  if (auth.error) return auth.error;

  const { id } = await params;
  const evidence = await getEvidence(id);
  if (!evidence) {
    return NextResponse.json({ error: 'Evidence item not found' }, { status: 404 });
  }

  const doi = normalizeDoi(evidence.doi);
  const pmid = evidence.pmid || null;

  if (!doi && !pmid) {
    return NextResponse.json({
      enriched: false,
      reason: 'No DOI or PMID available — cannot look up in PubMed',
    });
  }

  const result = await enrichArticle({ doi, pmid, title: evidence.name, pdfUrl: evidence.pdf || null });

  if (!result.enriched) {
    return NextResponse.json({ enriched: false, reason: result.reason });
  }

  // Build update payload — only fill empty fields
  const updates = {};
  const changes = [];

  if (!evidence.canonicalSummary && result.summary) {
    updates.canonicalSummary = result.summary;
    changes.push('summary');
  }
  if ((!evidence.ingredient || evidence.ingredient.length === 0) && result.ingredients.length > 0) {
    updates.ingredient = result.ingredients;
    changes.push(`ingredients: ${result.ingredients.join(', ')}`);
  }
  if (!evidence.publicationYear && result.year) {
    updates.publicationYear = parseInt(result.year);
    changes.push(`year: ${result.year}`);
  }
  if (!evidence.pmid && result.pmid) {
    updates.pmid = result.pmid;
    changes.push(`pmid: ${result.pmid}`);
  }
  if (!doi && result.doi) {
    updates.doi = result.doi;
    changes.push(`doi: ${result.doi}`);
  }

  if (Object.keys(updates).length > 0) {
    await updateEvidence(id, updates);
  }

  return NextResponse.json({
    enriched: true,
    changes,
    ingredientReasoning: result.ingredientReasoning || null,
    noChanges: changes.length === 0 ? 'All fields already populated' : undefined,
  });
}
