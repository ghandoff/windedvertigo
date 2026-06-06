/**
 * Citation import engine: parse a document's reference list into structured
 * citations, plan how they map onto the existing bibliography (tag existing rows
 * with the asset vs. insert new ones), and apply. Review-first — planImport never
 * writes; applyImport does. Shared by the port UI (server actions) and the
 * agent-token API (assistant-run backfill).
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import {
  getBibliographyRows,
  insertBibliographyRow,
  updateBibliographyRow,
} from "@/lib/supabase/bibliography";

export interface ParsedCitation {
  fullCitation: string;
  year?: number | null;
  doi?: string | null;
  sourceType?: string | null;
}

export interface ImportPlan {
  asset: string;
  matched: { id: string; fullCitation: string }[]; // exists → will add asset to used_in
  alreadyTagged: { id: string; fullCitation: string }[]; // exists + already tagged
  newCitations: ParsedCitation[]; // will insert with used_in = [asset]
}

export interface InTextCitation {
  author: string; // first-author surname / org as it appears in-text
  year: number | null;
}

export interface InTextPlan {
  asset: string;
  matched: { id: string; fullCitation: string }[]; // resolved → will add asset
  alreadyTagged: { id: string; fullCitation: string }[]; // resolved + already tagged
  unresolved: InTextCitation[]; // no library match — listed, NOT inserted
}

const PARSE_SYSTEM = `you extract academic citations from a document's reference list (or text containing citations).

return ONLY a json array, one object per DISTINCT cited source:
[{ "fullCitation": "Author, A. A. (Year). Title. Venue, vol(issue), pages.", "year": 2020, "doi": "https://doi.org/…" or null, "sourceType": "Journal article|Book|Book chapter|Report|Conference paper|Thesis|Website" or null }]

rules:
- preserve the citation text faithfully (don't paraphrase).
- one entry per source; de-duplicate.
- ignore prose, headings, page numbers, and anything that isn't a citation.
- if there are no citations, return [].`;

/** Extract structured citations from arbitrary document text. */
export async function parseReferences(text: string): Promise<ParsedCitation[]> {
  if (!text?.trim()) return [];
  const res = await callClaude({
    feature: "bibliography-import",
    userId: "automation",
    system: PARSE_SYSTEM,
    userMessage: text.slice(0, 120_000),
    maxTokens: 8000,
    temperature: 0,
  });
  const arr = parseJsonResponse<ParsedCitation[]>(res.text);
  return Array.isArray(arr) ? arr.filter((c) => c?.fullCitation?.trim()) : [];
}

// alphanumeric-only key for fuzzy matching (handles "Hatano & Inagaki (1986)"
// vs the full APA form of the same work).
function normMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Map parsed citations onto the bibliography. Never writes. */
export async function planImport(parsed: ParsedCitation[], asset: string): Promise<ImportPlan> {
  const rows = await getBibliographyRows();
  const rowKeys = rows.map((r) => ({ row: r, k: normMatch(r.fullCitation) }));

  const matched: ImportPlan["matched"] = [];
  const alreadyTagged: ImportPlan["alreadyTagged"] = [];
  const newCitations: ParsedCitation[] = [];
  const seen = new Set<string>();

  for (const c of parsed) {
    const ck = normMatch(c.fullCitation);
    if (!ck || seen.has(ck)) continue;
    seen.add(ck);

    let row =
      rowKeys.find((x) => x.k === ck)?.row ??
      rowKeys.find(
        (x) => ck.length >= 15 && x.k.length >= 15 && (x.k.includes(ck) || ck.includes(x.k)),
      )?.row;

    if (row) {
      if ((row.usedIn ?? []).includes(asset)) {
        alreadyTagged.push({ id: row.id, fullCitation: row.fullCitation });
      } else {
        matched.push({ id: row.id, fullCitation: row.fullCitation });
      }
    } else {
      newCitations.push(c);
    }
  }

  return { asset, matched, alreadyTagged, newCitations };
}

/** Apply a plan: tag matched rows with the asset, insert new citations. */
export async function applyImport(plan: ImportPlan): Promise<{ tagged: number; inserted: number }> {
  const rows = await getBibliographyRows();
  const byId = new Map(rows.map((r) => [r.id, r]));

  let tagged = 0;
  let inserted = 0;

  for (const m of plan.matched) {
    const row = byId.get(m.id);
    if (!row) continue;
    const next = Array.from(new Set([...(row.usedIn ?? []), plan.asset]));
    await updateBibliographyRow(m.id, { usedIn: next });
    tagged++;
  }

  for (const c of plan.newCitations) {
    const res = await insertBibliographyRow({
      fullCitation: c.fullCitation,
      year: c.year ?? null,
      doi: c.doi ?? null,
      sourceType: c.sourceType ?? undefined,
      usedIn: [plan.asset],
    });
    if (res.created) inserted++;
  }

  return { tagged, inserted };
}

// Dedup key for single-adds (DOI auto-fill / discovery), where a Crossref
// citation differs from our stored APA in author-initial style, title case, and a
// trailing DOI. Drop standalone initials, keep surname+year+title-start, ignore the
// tail — so "Edmondson, A. C. (1999). Psychological Safety…" matches
// "Edmondson, A. (1999). Psychological safety…".
function dedupeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]\b/g, " ") // drop single-letter initials
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 60); // surname + year + title-start
}

/** Fuzzy-find an existing row that's the same work as `fullCitation`. */
export async function findSimilar(
  fullCitation: string,
): Promise<{ id: string; fullCitation: string } | null> {
  const key = dedupeKey(fullCitation);
  if (key.length < 12) return null;
  const rows = await getBibliographyRows();
  const hit = rows.find((r) => dedupeKey(r.fullCitation) === key);
  return hit ? { id: hit.id, fullCitation: hit.fullCitation } : null;
}

// ── in-text citations ────────────────────────────────────
// For documents with NO reference list — extract inline cites and tag the
// bibliography rows they point to. Tag-only: unmatched cites are listed, never
// inserted (an author+year alone isn't a usable citation).

const INTEXT_SYSTEM = `you extract IN-TEXT (inline) academic citations from prose.

return ONLY a json array, one object per DISTINCT cited work:
[{ "author": "FirstAuthorSurname", "year": 2020 }]

rules:
- handle "(Smith, 2020)", "Smith (2020)", "Smith et al., 2020", "Smith & Jones (2020)", and grouped "(Smith, 2020; Lee, 2021)".
- "author" = ONLY the FIRST author's surname (or the organisation acronym/name if that's how it's cited, e.g. "PRME", "UNICEF"). drop "et al.", initials, and co-authors.
- de-duplicate identical author+year pairs.
- ignore years that aren't citations (e.g. "in 2020 we ran…", dates, statistics).
- if there are no in-text citations, return [].`;

/** Extract inline citations from prose. */
export async function parseInTextCitations(text: string): Promise<InTextCitation[]> {
  if (!text?.trim()) return [];
  const res = await callClaude({
    feature: "bibliography-import",
    userId: "automation",
    system: INTEXT_SYSTEM,
    userMessage: text.slice(0, 120_000),
    maxTokens: 4000,
    temperature: 0,
  });
  const arr = parseJsonResponse<InTextCitation[]>(res.text);
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: InTextCitation[] = [];
  for (const c of arr) {
    const author = (c?.author ?? "").trim();
    const year = typeof c?.year === "number" ? c.year : null;
    if (!author) continue;
    const key = `${author.toLowerCase()}|${year ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ author, year });
  }
  return out;
}

// the leading author portion of a citation (everything before the first "(YYYY")
function leadAuthors(fullCitation: string): string {
  const m = fullCitation.match(/^(.*?)\(\s*\d{4}/);
  return (m ? m[1] : fullCitation.slice(0, 64)).toLowerCase();
}
// alpha-only surname token for matching
function authorToken(s: string): string {
  return s.toLowerCase().replace(/\bet al\.?/g, " ").replace(/[^a-z]+/g, "").trim();
}

/** Resolve in-text cites against the library by first-author surname + year. */
export async function planInText(parsed: InTextCitation[], asset: string): Promise<InTextPlan> {
  const rows = await getBibliographyRows();
  const rowKeys = rows.map((r) => ({ row: r, lead: leadAuthors(r.fullCitation), year: r.year }));

  const matched: InTextPlan["matched"] = [];
  const alreadyTagged: InTextPlan["alreadyTagged"] = [];
  const unresolved: InTextCitation[] = [];
  const seenRow = new Set<string>();

  for (const c of parsed) {
    const tok = authorToken(c.author);
    if (!tok) continue;
    const hit = rowKeys.find(
      (x) => (c.year == null || x.year === c.year) && authorToken(x.lead).includes(tok),
    )?.row;

    if (!hit) {
      unresolved.push(c);
      continue;
    }
    if (seenRow.has(hit.id)) continue; // two cites → same row
    seenRow.add(hit.id);
    if ((hit.usedIn ?? []).includes(asset)) {
      alreadyTagged.push({ id: hit.id, fullCitation: hit.fullCitation });
    } else {
      matched.push({ id: hit.id, fullCitation: hit.fullCitation });
    }
  }

  return { asset, matched, alreadyTagged, unresolved };
}

/** Apply an in-text plan: tag matched rows only. Inserts nothing. Idempotent. */
export async function applyInText(plan: InTextPlan): Promise<{ tagged: number }> {
  const rows = await getBibliographyRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  let tagged = 0;
  for (const m of plan.matched) {
    const row = byId.get(m.id);
    if (!row) continue;
    const next = Array.from(new Set([...(row.usedIn ?? []), plan.asset]));
    await updateBibliographyRow(m.id, { usedIn: next });
    tagged++;
  }
  return { tagged };
}
