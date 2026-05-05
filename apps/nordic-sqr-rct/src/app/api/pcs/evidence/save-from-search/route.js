/**
 * POST /api/pcs/evidence/save-from-search
 *
 * Research-team article tool — chains:
 *   1. Discovery hit (already retrieved by /api/pcs/evidence/search)
 *   2. The same 7-tier PDF-retrieval waterfall used by PCS imports
 *      (Unpaywall → Semantic Scholar → CORE → OpenAlex → Europe PMC →
 *      bioRxiv/medRxiv → NCBI PMC) — see src/lib/pmc.js findAndFetchPdf
 *   3. Evidence-row creation (orphan; not yet tied to any PCS document)
 *
 * Goal: eliminate duplicated effort across the research team. As
 * researchers browse and add articles to the Evidence Library, later
 * PCS imports that cite the same DOI/PMID find the existing row via
 * the advisory dedup in createEvidence rather than creating a copy.
 *
 * Capability gate: pcs.evidence:attach (same as POST /api/pcs/evidence).
 *
 * Request body:
 *   {
 *     title, doi, pmid, year, journal, authors, abstract,
 *     evidenceType, openAccessPdf
 *   }
 *
 * Response:
 *   {
 *     evidenceId,
 *     pdfSource,            // 'unpaywall' | 'europe_pmc' | ... | 'discovery' | null
 *     pdfUrl,               // Blob URL when waterfall hit; else discovery URL; else null
 *     waterfallAttempts,    // per-tier success/failure log from findPdfUrl
 *     entry,                // the created evidence row
 *   }
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth/require-capability';
import { createEvidence } from '@/lib/pcs-evidence';
import { findAndFetchPdf } from '@/lib/pmc';
import { isAutoFeedEnabled, feedToIntake } from '@/lib/pcs-intake-feed';

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:attach', {
    route: '/api/pcs/evidence/save-from-search',
  });
  if (auth.error) return auth.error;

  const hit = await request.json();
  if (!hit?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  // Run the 7-tier waterfall when we have an identifier. No identifier
  // means metadata-only save — a row with title/year/journal but no PDF.
  let pdfSource = null;
  let pdfUrl = null;
  let waterfallAttempts = [];
  if (hit.doi || hit.pmid) {
    const filename = safeFilename(hit.doi, hit.pmid);
    try {
      const result = await findAndFetchPdf({ doi: hit.doi, pmid: hit.pmid, filename });
      waterfallAttempts = result.attempts || [];
      if (result.fetched) {
        pdfSource = result.source; // tier that hit
        pdfUrl = result.url;       // rehosted Blob URL
      }
    } catch (err) {
      // Non-fatal — we still create the row with metadata.
      console.warn(`[save-from-search] waterfall failed: ${err.message}`);
    }
  }

  // Fall back to whatever single openAccessPdf the discovery tier
  // surfaced if the retrieval waterfall missed. This preserves the
  // pre-tier-chaining behavior for paywalled-but-S2-knew-an-OA-link
  // edge cases.
  if (!pdfUrl && hit.openAccessPdf) {
    pdfSource = 'discovery';
    pdfUrl = hit.openAccessPdf;
  }

  const entry = await createEvidence({
    name: hit.title,
    doi: hit.doi || undefined,
    pmid: hit.pmid || undefined,
    url: hit.url || undefined,
    publicationYear: hit.year || undefined,
    evidenceType: hit.evidenceType || 'RCT',
    pdf: pdfUrl || undefined,
    canonicalSummary: hit.abstract ? hit.abstract.slice(0, 1900) : undefined,
  });
  revalidatePath('/api/pcs/evidence');

  // Fire-and-forget SQR-RCT intake routing — same pattern as the
  // generic POST /api/pcs/evidence handler so the new entry point
  // doesn't bypass review queueing.
  if (isAutoFeedEnabled()) {
    feedToIntake(entry)
      .then((r) => r.status === 'created' && process.env.NODE_ENV !== 'production' && console.log('[auto-feed] queued for review:', entry.name))
      .catch((err) => console.error('[auto-feed] failed:', entry.name, err.message));
  }

  return NextResponse.json(
    {
      evidenceId: entry.id,
      pdfSource,
      pdfUrl,
      waterfallAttempts,
      entry,
    },
    { status: 201 },
  );
}

/**
 * Build a Blob-safe filename. findAndFetchPdf falls through to
 * `${doi || pmid || 'unknown'}.pdf` if we don't pass one, but DOIs
 * contain slashes which collide with the Blob path; sanitize here.
 */
function safeFilename(doi, pmid) {
  const seed = doi || pmid || 'article';
  const slug = String(seed).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `${slug}.pdf`;
}
