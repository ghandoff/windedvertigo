/**
 * GET /api/port/evidence-search?q=&kind=&limit=
 *
 * sibling endpoint called by the cowork `inject-evidence-from-port` skill to
 * retrieve relevant past work, methodology kernels, and bd assets that
 * strengthen a proposal section being drafted locally.
 *
 * results blend three sources:
 *   - kind="asset"        → bd_assets table (portfolio + featured experience)
 *   - kind="rfp-excerpt"  → closed-won rfp_opportunities (requirements_snapshot, what_worked)
 *   - kind="methodology"  → in-file canonical kernels (lib/methodology-blocks.ts)
 *
 * auth: session via auth() OR bearer token matching CRON_SECRET (programmatic).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { error as errorJson, json } from "@/lib/api-helpers";
import { getBdAssetsFromSupabase } from "@/lib/supabase/bd-assets";
import { supabase } from "@/lib/supabase/client";
import { METHODOLOGY_BLOCKS, type MethodologyBlock } from "@/lib/methodology-blocks";
import type { BdAsset } from "@/lib/notion/types";

// ── contract types ──────────────────────────────────────────────────

type EvidenceKind = "asset" | "rfp-excerpt" | "methodology";

interface EvidenceCitation {
  format: "internal" | "apa";
  text: string;
  url: string;
}

interface EvidenceResult {
  id: string;
  kind: EvidenceKind;
  title: string;
  snippet: string;
  relevance: number;
  citation: EvidenceCitation;
  metadata: {
    year?: number;
    client?: string;
    tags?: string[];
    outcome?: string;
  };
}

interface EvidenceSearchResponse {
  results: EvidenceResult[];
  totalMatched: number;
  kinds: { asset: number; "rfp-excerpt": number; methodology: number };
}

// ── tunables ────────────────────────────────────────────────────────

/** drop anything below this — keeps weak overlaps out of the response. */
const MIN_RELEVANCE = 0.2;
/** snippet is meant to fit in cowork preview cards. */
const SNIPPET_MAX = 200;
/** clamp the input so a runaway client cannot drive a giant ilike. */
const QUERY_MAX_CHARS = 200;
/** clamp result limit so the response stays well under cowork's context budget. */
const LIMIT_MIN = 1;
const LIMIT_MAX = 25;
const LIMIT_DEFAULT = 10;
/** how many candidates to pull per source before ranking + clipping. */
const ASSET_FETCH_PAGE_SIZE = 100;
/** absolute deep-link base — citations are consumed outside the port. */
const PORT_BASE_URL = "https://port.windedvertigo.com";
/** stopwords stripped before tokenizing — keeps overlap scoring meaningful. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "by", "at", "is", "as", "be", "from", "that", "this", "it", "we", "our",
  "their", "they", "are", "was", "were", "will", "can", "has", "have",
  "had", "but", "not", "no", "so", "if", "then", "than", "who", "what",
  "when", "where", "why", "how", "do", "does", "did", "i", "you",
]);

// ── auth ────────────────────────────────────────────────────────────

/** bearer-first, session-fallback. middleware also gates this, but routes
 * still validate so a misconfigured matcher cannot leak data. */
async function authorize(req: NextRequest): Promise<boolean> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ") && process.env.CRON_SECRET) {
    if (header.slice(7) === process.env.CRON_SECRET) return true;
  }
  const session = await auth();
  return Boolean(session?.user?.email);
}

// ── tokenization + scoring ──────────────────────────────────────────

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** weighted token-overlap score, normalized to 0..1. title carries the most
 * weight because section headings are the primary search vector from cowork. */
function scoreCandidate(
  qTokens: Set<string>,
  candidate: { title: string; tags?: string[]; snippet: string },
): number {
  if (qTokens.size === 0) return 0;
  const titleTokens = new Set(tokenize(candidate.title));
  const tagTokens = new Set((candidate.tags ?? []).flatMap((t) => tokenize(t)));
  const snippetTokens = new Set(tokenize(candidate.snippet));

  let score = 0;
  for (const t of qTokens) {
    if (titleTokens.has(t)) score += 2;
    else if (tagTokens.has(t)) score += 1.5;
    else if (snippetTokens.has(t)) score += 1;
  }

  // normalize: best-case is every query token hits the title (weight 2x).
  const max = qTokens.size * 2;
  return Math.min(1, score / max);
}

function truncate(s: string, max = SNIPPET_MAX): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ── search: bd assets ───────────────────────────────────────────────

async function searchAssets(q: string, qTokens: Set<string>): Promise<EvidenceResult[]> {
  // we use the existing supabase read layer (phase G.1.3 already moved bd_assets
  // off notion). pull a generous candidate window and rank in-memory because
  // ilike-on-asset alone misses tag/description matches.
  const { data } = await getBdAssetsFromSupabase(
    { search: q },
    { page: 1, pageSize: ASSET_FETCH_PAGE_SIZE },
  );

  // also do a parallel pull without the search filter so tag/description hits
  // surface even when the title is unrelated. capped by readiness=published-ish
  // would be ideal, but the supabase layer doesn't filter on readiness in
  // search mode and the in-memory rank step drops the noise.
  const fallback = qTokens.size > 0
    ? await getBdAssetsFromSupabase(
        { /* unfiltered */ },
        { page: 1, pageSize: ASSET_FETCH_PAGE_SIZE },
      )
    : { data: [] as BdAsset[], total: 0 };

  // dedupe by id, prefer the title-matched entry order.
  const seen = new Set<string>();
  const merged: BdAsset[] = [];
  for (const a of [...data, ...fallback.data]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    merged.push(a);
  }

  return merged.map((a) => {
    const snippet = truncate(a.description || a.asset);
    const relevance = scoreCandidate(qTokens, {
      title: a.asset,
      tags: a.tags,
      snippet: a.description ?? "",
    });
    const citationText = `(WindedVertigo) — ${a.asset}`;
    const citationUrl = a.url || `${PORT_BASE_URL}/assets`;
    const result: EvidenceResult = {
      id: a.id,
      kind: "asset",
      title: a.asset,
      snippet,
      relevance,
      citation: { format: "internal", text: citationText, url: citationUrl },
      metadata: {
        tags: a.tags,
        outcome: a.readiness ? `readiness · ${a.readiness}` : undefined,
      },
    };
    return result;
  });
}

// ── search: closed-won rfp excerpts ─────────────────────────────────

interface RfpExcerptRow {
  notion_page_id: string;
  opportunity_name: string;
  requirements_snapshot: string | null;
  what_worked: string | null;
  client_feedback: string | null;
  due_date: string | null;
  status: string | null;
}

async function searchRfpExcerpts(
  q: string,
  qTokens: Set<string>,
): Promise<EvidenceResult[]> {
  // closed-won is the bar — `status = 'won'` per the rfp pipeline. we union
  // matches across the two narrative columns (`requirements_snapshot`,
  // `what_worked`) and let the in-memory ranker pick the best per row.
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from("rfp_opportunities")
    .select(
      "notion_page_id, opportunity_name, requirements_snapshot, what_worked, client_feedback, due_date, status",
    )
    .eq("status", "won")
    .or(
      `requirements_snapshot.ilike.${like},what_worked.ilike.${like},opportunity_name.ilike.${like}`,
    )
    .limit(50);

  if (error) {
    console.warn("[evidence-search] rfp ilike failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as RfpExcerptRow[];

  return rows.map((r) => {
    // pick the most-relevant column to surface as snippet.
    const candidates = [
      r.what_worked ?? "",
      r.requirements_snapshot ?? "",
      r.client_feedback ?? "",
    ].filter(Boolean);
    const snippet = truncate(candidates[0] ?? r.opportunity_name);
    const relevance = scoreCandidate(qTokens, {
      title: r.opportunity_name,
      tags: [],
      snippet: candidates.join(" "),
    });
    const year = r.due_date ? new Date(r.due_date).getUTCFullYear() : undefined;
    const citationText = year
      ? `(WindedVertigo, ${year}) — ${r.opportunity_name}`
      : `(WindedVertigo) — ${r.opportunity_name}`;
    const result: EvidenceResult = {
      id: r.notion_page_id,
      kind: "rfp-excerpt",
      title: r.opportunity_name,
      snippet,
      relevance,
      citation: {
        format: "internal",
        text: citationText,
        url: `${PORT_BASE_URL}/rfp-radar/${r.notion_page_id}`,
      },
      metadata: {
        year,
        outcome: r.status === "won" ? "engagement won" : (r.status ?? undefined),
      },
    };
    return result;
  });
}

// ── search: methodology blocks ──────────────────────────────────────

function searchMethodology(qTokens: Set<string>): EvidenceResult[] {
  return METHODOLOGY_BLOCKS.map((b: MethodologyBlock) => {
    const relevance = scoreCandidate(qTokens, {
      title: b.title,
      tags: b.tags,
      snippet: b.snippet,
    });
    const result: EvidenceResult = {
      id: b.id,
      kind: "methodology",
      title: b.title,
      snippet: truncate(b.snippet),
      relevance,
      citation: {
        format: "internal",
        text: `(WindedVertigo methodology) — ${b.title}`,
        // canonical source lives in ghandoff/wv-proposals; until that's
        // mirrored into the port, deep-link to the port's portfolio page.
        url: `${PORT_BASE_URL}/assets`,
      },
      metadata: { tags: b.tags },
    };
    return result;
  });
}

// ── handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return errorJson("unauthorized", 401);
  }

  const sp = req.nextUrl.searchParams;
  const rawQ = sp.get("q") ?? "";
  const decoded = decodeURIComponent(rawQ).trim();

  if (!decoded) return errorJson("missing query", 400);

  const q = decoded.slice(0, QUERY_MAX_CHARS);

  const kindParam = (sp.get("kind") ?? "all").toLowerCase();
  if (!["asset", "rfp-excerpt", "methodology", "all"].includes(kindParam)) {
    return errorJson("invalid kind", 400);
  }
  const kind = kindParam as EvidenceKind | "all";

  const limitRaw = sp.get("limit");
  const limit = limitRaw
    ? Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Number.parseInt(limitRaw, 10) || LIMIT_DEFAULT))
    : LIMIT_DEFAULT;

  const qTokens = new Set(tokenize(q));

  try {
    const [assetResults, rfpResults, methodologyResults] = await Promise.all([
      kind === "asset" || kind === "all" ? searchAssets(q, qTokens) : Promise.resolve([]),
      kind === "rfp-excerpt" || kind === "all" ? searchRfpExcerpts(q, qTokens) : Promise.resolve([]),
      kind === "methodology" || kind === "all"
        ? Promise.resolve(searchMethodology(qTokens))
        : Promise.resolve([]),
    ]);

    const all = [...assetResults, ...rfpResults, ...methodologyResults]
      .filter((r) => r.relevance >= MIN_RELEVANCE)
      .sort((a, b) => b.relevance - a.relevance);

    const kindCounts = {
      asset: all.filter((r) => r.kind === "asset").length,
      "rfp-excerpt": all.filter((r) => r.kind === "rfp-excerpt").length,
      methodology: all.filter((r) => r.kind === "methodology").length,
    };

    const results = all.slice(0, limit);

    const body: EvidenceSearchResponse = {
      results,
      totalMatched: all.length,
      kinds: kindCounts,
    };

    return json(body);
  } catch (err) {
    console.error("[evidence-search] failed:", err);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
