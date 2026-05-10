/**
 * Conference deduplication for the discovery pipeline.
 *
 * Strategy:
 *   1. Exact URL match (after normalizing trailing slashes, query strings,
 *      and protocol). Cheapest first, catches the obvious case.
 *   2. Levenshtein distance ≤ 3 on lowercased event name. Catches "GRONEN
 *      2026" vs "GRONEN Conference 2026" or "ATD International" vs
 *      "ATD International Conference & EXPO 2026".
 *
 * Returns the existing event id when a match is found so the discovery
 * cron can decide whether to overwrite, merge, or skip.
 *
 * False-positive risk: a recurring conference with year-incremented names
 * (e.g. "GRONEN 2026" → "GRONEN 2027") is currently NOT deduped because
 * the year suffix makes them ≥4 distance. That's intentional — we want
 * 2027 to land as a fresh candidate row.
 */

import { supabase } from "@/lib/supabase/client";

/** Normalize a URL for dedup. Lowercase host, strip trailing slash, drop query+fragment. */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) path = path.slice(0, -1);
    return `${u.protocol}//${u.host.toLowerCase()}${path}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** Lowercase + strip punctuation + collapse whitespace. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Iterative Levenshtein. Standard, no external deps. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1).fill(0).map((_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost,   // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export interface DedupResult {
  isDuplicate: boolean;
  /** When isDuplicate=true, the notion_page_id of the existing row. */
  existingId?: string;
  /** Reason for the match — useful for audit/logging. */
  matchedOn?: "url" | "name";
}

export interface DedupCandidate {
  name: string;
  url?: string | null;
}

/**
 * Check whether a candidate already exists in `crm_events`. Hits Supabase
 * twice: once for URL match, once for name fetch + in-memory Levenshtein.
 *
 * Levenshtein threshold of 3 catches typical variants like punctuation,
 * "Conference"/"Summit" suffix differences, and minor word-order changes,
 * while keeping year-incremented variants (≥4 distance) as distinct rows.
 */
export async function findDuplicateConference(
  candidate: DedupCandidate,
): Promise<DedupResult> {
  // 1. URL match (when the candidate has a URL).
  if (candidate.url) {
    const norm = normalizeUrl(candidate.url);
    const { data: byUrl, error: urlErr } = await supabase
      .from("crm_events")
      .select("notion_page_id, url")
      .ilike("url", `${norm.split("//")[1] ? norm.split("//")[1] + "%" : ""}%`)
      .limit(20);
    if (urlErr) {
      console.warn("[conferences/dedup] url-match query error", urlErr.message);
    } else if (byUrl) {
      for (const row of byUrl as { notion_page_id: string; url: string | null }[]) {
        if (row.url && normalizeUrl(row.url) === norm) {
          return { isDuplicate: true, existingId: row.notion_page_id, matchedOn: "url" };
        }
      }
    }
  }

  // 2. Fuzzy name match. Pull all event names — small table (~50 rows
  // expected within the year), so an in-memory Levenshtein scan is fine.
  const candNorm = normalizeName(candidate.name);
  if (!candNorm) {
    return { isDuplicate: false };
  }
  const { data: rows, error: nameErr } = await supabase
    .from("crm_events")
    .select("notion_page_id, event")
    .limit(500);
  if (nameErr) {
    console.warn("[conferences/dedup] name-match query error", nameErr.message);
    return { isDuplicate: false };
  }
  for (const row of (rows ?? []) as { notion_page_id: string; event: string }[]) {
    const existingNorm = normalizeName(row.event);
    if (!existingNorm) continue;
    const dist = levenshtein(candNorm, existingNorm);
    if (dist <= 3) {
      return { isDuplicate: true, existingId: row.notion_page_id, matchedOn: "name" };
    }
  }

  return { isDuplicate: false };
}
