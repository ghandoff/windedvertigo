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
