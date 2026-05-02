import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { getAllStudies } from '@/lib/notion';
import { normalizeDoi } from '@/lib/doi';
import { Client } from '@notionhq/client';
import { withRetry } from '@/lib/notion';

export const maxDuration = 300; // 5 minutes — could be many lookups

const PUBMED_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const PUBMED_ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';

const _notion = new Client({ auth: process.env.NOTION_TOKEN, timeoutMs: 30000 });
const notion = {
  pages: { update: (...args) => withRetry(() => _notion.pages.update(...args)) },
};

/**
 * POST /api/admin/backfill/dois
 *
 * Scans PCS Evidence Library AND SQR-RCT Intake DB for entries missing DOIs,
 * searches PubMed by PMID or title/author, and populates DOI fields.
 *
 * Query params:
 *   dry_run=true  — preview matches without writing
 *   source=pcs|sqr|both  — which database(s) to scan (default: both)
 */
export async function POST(request) {
  // Wave 7.5 Batch C — DOI backfill mutates schema-shaped fields.
  const gate = await requireCapability(request, 'schema:edit', { route: '/api/admin/backfill/dois' });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';
  const source = searchParams.get('source') || 'both';

  const report = { pcs: [], sqr: [] };

  try {
    // ── PCS Evidence Library ──────────────────────────────────────────
    if (source === 'pcs' || source === 'both') {
      const pcsEntries = await getAllEvidence();
      const missingDoi = pcsEntries.filter(e => !normalizeDoi(e.doi));

      for (const entry of missingDoi) {
        const result = await lookupDoi({
          name: entry.name,
          citation: entry.citation || '',
          pmid: entry.pmid || null,
          year: entry.publicationYear || null,
        });

        const item = {
          id: entry.id,
          name: entry.name,
          pmid: entry.pmid || null,
          ...result,
        };

        if (result.doi && !dryRun) {
          try {
            // PCS DOI is rich_text type
            await notion.pages.update({
              page_id: entry.id,
              properties: {
                'DOI': { rich_text: [{ text: { content: result.doi } }] },
                // Backfill PMID if we found one and it's missing
                ...(!entry.pmid && result.pmid ? {
                  'PMID': { rich_text: [{ text: { content: result.pmid } }] },
                } : {}),
              },
            });
            item.written = true;
          } catch (err) {
            item.writeError = err.message;
          }
        }

        report.pcs.push(item);
        await new Promise(r => setTimeout(r, 400)); // rate limit
      }
    }

    // ── SQR-RCT Intake DB ─────────────────────────────────────────────
    if (source === 'sqr' || source === 'both') {
      const studies = await getAllStudies();
      const missingDoi = studies.filter(s => !s.doi || !normalizeDoi(s.doi));

      for (const study of missingDoi) {
        // Extract first author and short title from citation (title property)
        const result = await lookupDoi({
          name: study.citation || '', // SQR-RCT uses citation as title
          citation: study.citation || '',
          pmid: null, // SQR-RCT doesn't have PMID field
          year: study.year || null,
          journal: study.journal || null,
        });

        const item = {
          id: study.id,
          name: study.citation,
          ...result,
        };

        if (result.doi && !dryRun) {
          try {
            // SQR-RCT DOI is url type — store as full URL
            const doiUrl = result.doi.startsWith('http')
              ? result.doi
              : `https://doi.org/${result.doi}`;
            await notion.pages.update({
              page_id: study.id,
              properties: {
                'DOI': { url: doiUrl },
              },
            });
            item.written = true;
          } catch (err) {
            item.writeError = err.message;
          }
        }

        report.sqr.push(item);
        await new Promise(r => setTimeout(r, 400)); // rate limit
      }
    }

    // ── Build summary ─────────────────────────────────────────────────
    const pcsFound = report.pcs.filter(r => r.doi).length;
    const pcsNotFound = report.pcs.filter(r => !r.doi).length;
    const sqrFound = report.sqr.filter(r => r.doi).length;
    const sqrNotFound = report.sqr.filter(r => !r.doi).length;

    return NextResponse.json({
      summary: {
        dryRun,
        pcsMissingDoi: report.pcs.length,
        pcsResolved: pcsFound,
        pcsUnresolved: pcsNotFound,
        sqrMissingDoi: report.sqr.length,
        sqrResolved: sqrFound,
        sqrUnresolved: sqrNotFound,
      },
      details: {
        pcs: report.pcs,
        sqr: report.sqr,
      },
    });
  } catch (err) {
    console.error('DOI backfill failed:', err);
    return NextResponse.json({ error: 'Backfill failed', message: err.message }, { status: 500 });
  }
}

// ─── PubMed Lookup Logic ──────────────────────────────────────────────

/**
 * Try to find a DOI for an article using PubMed.
 * Strategy:
 *   1. If PMID known → fetch metadata (DOI is usually included)
 *   2. Search by title keywords + first author + year
 *   3. Validate match by comparing title similarity
 *
 * @returns {{ doi: string|null, pmid: string|null, method: string, reason?: string }}
 */
async function lookupDoi({ name, citation, pmid, year, journal }) {
  // Strategy 1: PMID → DOI
  if (pmid) {
    try {
      const metadata = await fetchPubMedSummary(pmid);
      if (metadata.doi) {
        return { doi: metadata.doi, pmid, method: 'pmid_lookup', matchTitle: metadata.title };
      }
      // PMID exists but no DOI in PubMed record (rare)
      return { doi: null, pmid, method: 'pmid_no_doi', reason: 'PubMed record has no DOI' };
    } catch {
      return { doi: null, pmid, method: 'pmid_error', reason: 'PubMed lookup failed for PMID' };
    }
  }

  // Strategy 2: Search by title + author
  const searchInfo = extractSearchTerms(name, citation, year);
  if (!searchInfo.query) {
    return { doi: null, pmid: null, method: 'no_search_terms', reason: 'Could not extract title or author from citation' };
  }

  try {
    const searchResult = await searchPubMed(searchInfo.query);
    if (!searchResult.pmid) {
      // Try broader search without year
      if (searchInfo.broadQuery) {
        const broadResult = await searchPubMed(searchInfo.broadQuery);
        if (!broadResult.pmid) {
          return {
            doi: null, pmid: null, method: 'not_found',
            reason: `No PubMed match for: ${searchInfo.query}`,
            searchTerms: searchInfo,
          };
        }
        // Fetch metadata to get DOI
        const metadata = await fetchPubMedSummary(broadResult.pmid);
        if (metadata.doi) {
          return { doi: metadata.doi, pmid: broadResult.pmid, method: 'broad_title_search', matchTitle: metadata.title };
        }
        return { doi: null, pmid: broadResult.pmid, method: 'found_no_doi', reason: 'PubMed match found but record has no DOI' };
      }
      return {
        doi: null, pmid: null, method: 'not_found',
        reason: `No PubMed match for: ${searchInfo.query}`,
        searchTerms: searchInfo,
      };
    }

    // Fetch metadata to get DOI
    const metadata = await fetchPubMedSummary(searchResult.pmid);
    if (metadata.doi) {
      return { doi: metadata.doi, pmid: searchResult.pmid, method: 'title_search', matchTitle: metadata.title };
    }
    return { doi: null, pmid: searchResult.pmid, method: 'found_no_doi', reason: 'PubMed match found but record has no DOI' };
  } catch {
    return { doi: null, pmid: null, method: 'search_error', reason: 'PubMed search request failed' };
  }
}

/**
 * Extract search terms from citation text.
 * Parses "Author et al. YYYY" patterns and builds PubMed queries.
 */
function extractSearchTerms(name, citation, year) {
  // Try to extract first author from name (usually "Author et al. YYYY" format)
  const authorMatch = name.match(/^([A-Za-zÀ-ÿ'-]+)/);
  const firstAuthor = authorMatch?.[1] || '';

  // Extract year from name if not provided
  if (!year) {
    const yearMatch = name.match(/\b(19|20)\d{2}\b/);
    year = yearMatch ? parseInt(yearMatch[0]) : null;
  }

  // Try to get more title words from citation
  // Citations are typically: "Authors. Title. Journal. Year;Vol(Issue):Pages."
  let titleWords = '';
  if (citation) {
    const parts = citation.split('. ');
    // Title is usually the 2nd segment (after authors)
    if (parts.length >= 2) {
      titleWords = parts[1]
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5)
        .join(' ');
    }
  }

  // Build query
  const queryParts = [];
  if (firstAuthor && firstAuthor.length > 2) queryParts.push(`${firstAuthor}[Author]`);
  if (titleWords) queryParts.push(`${titleWords}[Title]`);
  if (year) queryParts.push(`${year}[Date - Publication]`);

  const query = queryParts.length >= 2 ? queryParts.join(' AND ') : '';

  // Broad query without year for fallback
  const broadParts = queryParts.filter(p => !p.includes('[Date'));
  const broadQuery = broadParts.length >= 2 ? broadParts.join(' AND ') : '';

  return { firstAuthor, titleWords, year, query, broadQuery };
}

/**
 * Search PubMed and return the first matching PMID.
 */
async function searchPubMed(query) {
  const url = `${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=1`;
  const res = await fetch(url);
  if (!res.ok) return { pmid: null };
  const data = await res.json();
  const ids = data.esearchresult?.idlist;
  return { pmid: ids?.length > 0 ? ids[0] : null, count: parseInt(data.esearchresult?.count || '0') };
}

/**
 * Fetch article summary from PubMed by PMID.
 */
async function fetchPubMedSummary(pmid) {
  const url = `${PUBMED_ESUMMARY}?db=pubmed&id=${pmid}&retmode=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed summary failed: ${res.status}`);
  const data = await res.json();
  const record = data.result?.[pmid];
  if (!record) throw new Error(`PMID ${pmid} not found`);

  return {
    title: record.title || null,
    doi: record.articleids?.find(a => a.idtype === 'doi')?.value || null,
    journal: record.fulljournalname || record.source || null,
    year: record.pubdate?.match(/\d{4}/)?.[0] || null,
    authors: record.authors?.map(a => a.name).join(', ') || null,
  };
}
