import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllEvidence, updateEvidence } from '@/lib/pcs-evidence';
import { getAllStudies, updateStudyPdf } from '@/lib/notion';
import { findAndFetchPdf, findPdfUrl } from '@/lib/pmc';
import { normalizeDoi } from '@/lib/doi';

export const maxDuration = 300;

/**
 * POST /api/admin/backfill/pdfs
 *
 * Scans PCS Evidence Library and SQR-RCT Intake DB for entries missing PDFs.
 * Searches multiple open-access sources: Unpaywall, Semantic Scholar,
 * Europe PMC, and NCBI PMC. Downloads and uploads found PDFs to Blob storage.
 *
 * Query params:
 *   dry_run=true  — preview only, no downloads or writes
 *   source=pcs|sqr|both (default: both)
 */
export async function POST(request) {
  // Wave 7.5 Batch C — PDF backfill writes to the documents library.
  const gate = await requireCapability(request, 'pcs.documents:edit', { route: '/api/admin/backfill/pdfs' });
  if (gate.error) return gate.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      error: 'BLOB_READ_WRITE_TOKEN is not configured — cannot upload PDFs',
    }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';
  const source = searchParams.get('source') || 'both';

  const results = {
    pcs: { fetched: [], alreadyHasPdf: 0, noIdentifier: [], notFound: [], errors: [] },
    sqr: { fetched: [], alreadyHasPdf: 0, noIdentifier: [], notFound: [], errors: [] },
  };

  try {
    // ── PCS Evidence Library ──────────────────────────────────────
    if (source === 'pcs' || source === 'both') {
      const entries = await getAllEvidence();

      for (const entry of entries) {
        // Skip if already has a PDF
        if (entry.pdf) {
          results.pcs.alreadyHasPdf++;
          continue;
        }

        const doi = normalizeDoi(entry.doi);
        const pmid = entry.pmid || null;

        if (!doi && !pmid) {
          results.pcs.noIdentifier.push({
            id: entry.id,
            name: entry.name,
            reason: 'No DOI or PMID — cannot search for PDF',
          });
          continue;
        }

        try {
          if (dryRun) {
            const check = await findPdfUrl({ doi, pmid });
            if (check.available) {
              results.pcs.fetched.push({
                id: entry.id,
                name: entry.name,
                doi, pmid,
                source: check.source,
                pdfUrl: check.pdfUrl,
                wouldFetch: true,
              });
            } else {
              results.pcs.notFound.push({
                id: entry.id,
                name: entry.name,
                doi, pmid,
                attempts: check.attempts,
              });
            }
          } else {
            const filename = doi
              ? `${doi.replace(/\//g, '_')}.pdf`
              : `pmid-${pmid}.pdf`;

            const result = await findAndFetchPdf({ pmid, doi, filename });

            if (result.fetched) {
              await updateEvidence(entry.id, { pdf: result.url });
              results.pcs.fetched.push({
                id: entry.id,
                name: entry.name,
                doi,
                source: result.source,
                size: result.size,
                url: result.url,
              });
            } else {
              results.pcs.notFound.push({
                id: entry.id,
                name: entry.name,
                doi, pmid,
                reason: result.reason,
                attempts: result.attempts,
              });
            }
          }
        } catch (err) {
          results.pcs.errors.push({
            id: entry.id,
            name: entry.name,
            error: err.message,
          });
        }

        // Rate limit across sources (~2 req/sec to be safe)
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // ── SQR-RCT Intake DB ─────────────────────────────────────────
    if (source === 'sqr' || source === 'both') {
      const studies = await getAllStudies();

      for (const study of studies) {
        if (study.pdf) {
          results.sqr.alreadyHasPdf++;
          continue;
        }

        // SQR-RCT stores DOI as full URL
        const doi = normalizeDoi(study.doi);
        const pmid = null; // SQR-RCT doesn't have a PMID field

        if (!doi) {
          results.sqr.noIdentifier.push({
            id: study.id,
            name: study.citation,
            reason: 'No DOI — cannot search for PDF',
          });
          continue;
        }

        try {
          if (dryRun) {
            const check = await findPdfUrl({ doi });
            if (check.available) {
              results.sqr.fetched.push({
                id: study.id,
                name: study.citation,
                doi,
                source: check.source,
                pdfUrl: check.pdfUrl,
                wouldFetch: true,
              });
            } else {
              results.sqr.notFound.push({
                id: study.id,
                name: study.citation,
                doi,
                attempts: check.attempts,
              });
            }
          } else {
            const filename = `${doi.replace(/\//g, '_')}.pdf`;
            const result = await findAndFetchPdf({ doi, filename });

            if (result.fetched) {
              await updateStudyPdf(study.id, result.url);
              results.sqr.fetched.push({
                id: study.id,
                name: study.citation,
                doi,
                source: result.source,
                size: result.size,
                url: result.url,
              });
            } else {
              results.sqr.notFound.push({
                id: study.id,
                name: study.citation,
                doi,
                reason: result.reason,
                attempts: result.attempts,
              });
            }
          }
        } catch (err) {
          results.sqr.errors.push({
            id: study.id,
            name: study.citation,
            error: err.message,
          });
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }

    // ── Cross-link: share PDFs between PCS ↔ SQR-RCT by DOI ─────
    // When one side has a PDF and the other doesn't, copy it over.
    const crossLinked = { pcsToSqr: 0, sqrToPcs: 0 };
    if (!dryRun) {
      const pcsEntries = source === 'both' ? await getAllEvidence() :
        source === 'pcs' ? await getAllEvidence() : [];
      const sqrStudies = source === 'both' ? await getAllStudies() :
        source === 'sqr' ? await getAllStudies() : [];

      // Build DOI → PDF lookup from each side
      const pcsByDoi = {};
      for (const e of pcsEntries) {
        const d = normalizeDoi(e.doi);
        if (d && e.pdf) pcsByDoi[d] = e.pdf;
      }
      const sqrByDoi = {};
      for (const s of sqrStudies) {
        const d = normalizeDoi(s.doi);
        if (d && s.pdf) sqrByDoi[d] = s.pdf;
      }

      // PCS → SQR: if PCS has PDF and SQR doesn't, write to SQR
      for (const s of sqrStudies) {
        if (s.pdf) continue;
        const d = normalizeDoi(s.doi);
        if (d && pcsByDoi[d]) {
          try {
            await updateStudyPdf(s.id, pcsByDoi[d]);
            crossLinked.pcsToSqr++;
          } catch { /* skip individual failures */ }
        }
      }

      // SQR → PCS: if SQR has PDF and PCS doesn't, write to PCS
      for (const e of pcsEntries) {
        if (e.pdf) continue;
        const d = normalizeDoi(e.doi);
        if (d && sqrByDoi[d]) {
          try {
            await updateEvidence(e.id, { pdf: sqrByDoi[d] });
            crossLinked.sqrToPcs++;
          } catch { /* skip individual failures */ }
        }
      }
    }

    // ── Summary ───────────────────────────────────────────────────
    const summary = {
      dryRun,
      pcs: {
        total: (results.pcs.alreadyHasPdf + results.pcs.fetched.length +
                results.pcs.noIdentifier.length + results.pcs.notFound.length +
                results.pcs.errors.length),
        alreadyHasPdf: results.pcs.alreadyHasPdf,
        fetched: results.pcs.fetched.length,
        notFound: results.pcs.notFound.length,
        noIdentifier: results.pcs.noIdentifier.length,
        errors: results.pcs.errors.length,
      },
      sqr: {
        total: (results.sqr.alreadyHasPdf + results.sqr.fetched.length +
                results.sqr.noIdentifier.length + results.sqr.notFound.length +
                results.sqr.errors.length),
        alreadyHasPdf: results.sqr.alreadyHasPdf,
        fetched: results.sqr.fetched.length,
        notFound: results.sqr.notFound.length,
        noIdentifier: results.sqr.noIdentifier.length,
        errors: results.sqr.errors.length,
      },
    };

    // Only include source sections that were scanned
    const details = {};
    if (source === 'pcs' || source === 'both') details.pcs = results.pcs;
    if (source === 'sqr' || source === 'both') details.sqr = results.sqr;

    if (!dryRun) summary.crossLinked = crossLinked;

    return NextResponse.json({ summary, details });
  } catch (err) {
    console.error('PDF backfill failed:', err);
    return NextResponse.json({ error: 'PDF backfill failed', message: err.message }, { status: 500 });
  }
}
