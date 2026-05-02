import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  fetchPubMedByPmid,
  fetchPubMedByDoi,
  summarizeArticle,
  detectIngredients,
} from '@/lib/pcs-enrichment';

/**
 * POST /api/pcs/enrichment — Enrich an evidence item with PubMed metadata + Claude summary.
 *
 * Body: { pmid?: string, doi?: string, summarize?: boolean }
 * Returns: { metadata, summary?, ingredients? }
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:enrich', { route: '/api/pcs/enrichment' });
  if (auth.error) return auth.error;

  try {
    const { pmid, doi, summarize = true } = await request.json();

    if (!pmid && !doi) {
      return NextResponse.json(
        { error: 'Provide either a PMID or DOI' },
        { status: 400 }
      );
    }

    // Fetch metadata from PubMed
    let metadata;
    if (pmid) {
      metadata = await fetchPubMedByPmid(pmid);
    } else {
      metadata = await fetchPubMedByDoi(doi);
      if (!metadata) {
        return NextResponse.json(
          { error: `No PubMed record found for DOI: ${doi}` },
          { status: 404 }
        );
      }
    }

    const result = { metadata };

    // Auto-detect ingredients
    result.ingredients = detectIngredients(metadata.title, metadata.abstract);

    // Generate summary via Claude (optional)
    if (summarize && metadata.abstract) {
      result.summary = await summarizeArticle(metadata);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('PCS enrichment error:', error);
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    );
  }
}
