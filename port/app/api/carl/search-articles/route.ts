/**
 * GET /api/carl/search-articles?query=…&limit=…
 *
 * Lets cARL (and the study cron) search the live academic literature — the same
 * federated search the bibliography uses (Crossref, OpenAlex, Semantic Scholar,
 * PubMed, arXiv, CORE in parallel, deduplicated). Returns compact hits + the
 * per-provider counts so cARL can both cite real sources and notice which
 * providers serve which domains.
 *
 * Auth: Bearer CMO_API_TOKEN (agent tool calls) or CRON_SECRET (study cron).
 */

import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { searchScholar } from "@/lib/bibliography/scholar";

export const maxDuration = 30;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CMO_API_TOKEN || token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const query = (param(req, "query") ?? "").trim();
  if (!query) return error("query is required", 400);
  const limit = Math.min(Math.max(Number(param(req, "limit")) || 8, 1), 20);

  try {
    const { hits, providers, errors } = await searchScholar(query, { limitPerProvider: 5 });

    // compact, LLM-friendly shape — only what's needed to choose + cite
    const results = hits.slice(0, limit).map((h, i) => ({
      index: i,
      title: h.title,
      authors: h.authors.slice(0, 6).join(", ") + (h.authors.length > 6 ? ", et al." : ""),
      year: h.year,
      venue: h.venue,
      doi: h.doi,
      citationCount: h.citationCount,
      hasOpenPdf: Boolean(h.openAccessPdf),
      sources: h.sources ?? [h.source],
      fullCitation: h.fullCitation ?? null,
    }));

    return json({
      query,
      count: results.length,
      results,
      providers, // [{ id, count }] — efficacy signal per source
      providerErrors: errors,
    });
  } catch (err) {
    console.error("[api/carl/search-articles]", err);
    return error("search failed", 500);
  }
}
