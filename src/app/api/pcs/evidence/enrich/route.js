import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  fetchPubMedByPmid,
  fetchPubMedByDoi,
  summarizeArticle,
  detectIngredientsWithContext,
} from '@/lib/pcs-enrichment';

export const maxDuration = 300;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function refineEvidenceType(abstract) {
  if (!abstract) return null;
  const text = abstract.toLowerCase();
  if (text.includes('randomized') || text.includes('randomised')) return 'RCT';
  if (text.includes('meta-analysis') || text.includes('meta analysis')) return 'Meta-analysis';
  if (text.includes('systematic review')) return 'Systematic review';
  if (text.includes('observational') || text.includes('cohort study') || text.includes('cross-sectional')) return 'Observational';
  if (text.includes('in vitro') || text.includes('cell culture')) return 'In vitro';
  if (text.includes('animal model') || text.includes('mice') || text.includes('rats')) return 'Animal';
  return null;
}

/**
 * POST /api/pcs/evidence/enrich — Batch-enrich evidence items with PubMed metadata.
 *
 * Body: { items: [{ doi?, pmid? }] }  (max 100)
 * Returns: { results: [...], errors: [...] }
 */
export async function POST(request) {
  try {
    const { user, error } = await requireCapability(request, 'pcs.evidence:enrich', { route: '/api/pcs/evidence/enrich' });
    if (error) return error;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items must be a non-empty array' },
        { status: 400 },
      );
    }

    if (items.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 items per request' },
        { status: 400 },
      );
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Skip if neither doi nor pmid is provided
        if (!item.doi && !item.pmid) {
          errors.push({ index: i, error: 'No DOI or PMID' });
          continue;
        }

        // Fetch PubMed metadata
        let metadata;
        if (item.pmid) {
          metadata = await fetchPubMedByPmid(item.pmid);
        } else if (item.doi) {
          metadata = await fetchPubMedByDoi(item.doi);
        }

        if (!metadata) {
          errors.push({ index: i, error: 'No PubMed match' });
          continue;
        }

        // Detect ingredients with context
        let ingredients = [];
        try {
          const ingredientResult = await detectIngredientsWithContext(metadata, null);
          ingredients = ingredientResult.ingredients;
        } catch (err) {
          console.error(`Ingredient detection failed for item ${i}:`, err.message);
        }

        // Optionally generate summary if LLM_API_KEY is set and abstract exists
        let summary = null;
        if (process.env.LLM_API_KEY && metadata.abstract) {
          try {
            summary = await summarizeArticle(metadata, null);
          } catch (err) {
            console.error(`Summarization failed for item ${i}:`, err.message);
          }
        }

        // Refine evidenceType from abstract keywords
        const refinedType = refineEvidenceType(metadata.abstract);

        results.push({
          index: i,
          metadata: {
            pmid: metadata.pmid,
            doi: metadata.doi,
            title: metadata.title,
            authors: metadata.authors,
            journal: metadata.journal,
            year: metadata.year,
            abstract: metadata.abstract,
          },
          ingredients,
          summary: summary || null,
          evidenceType: refinedType || null,
        });
      } catch (err) {
        console.error(`Enrichment error for item ${i}:`, err);
        errors.push({ index: i, error: err.message });
      }

      // Rate-limit: PubMed allows ~3 req/sec
      if (i < items.length - 1) {
        await delay(350);
      }
    }

    return NextResponse.json({ results, errors });
  } catch (err) {
    console.error('Unexpected enrichment error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
