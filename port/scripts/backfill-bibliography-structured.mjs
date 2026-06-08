/**
 * One-off backfill for the bibliography structured fields (authors, first_author,
 * journal) added in migration 20260607_bibliography_structured.sql.
 *
 * Strategy:
 *   - Rows WITH a DOI  → re-fetch clean authors + venue from Crossref (free, no key).
 *   - Rows WITHOUT a DOI → best-effort: first_author = leading text of the citation
 *     up to the year/first period; journal left null.
 *
 * Only writes the three new columns; never touches existing data. DML only —
 * runs through the service key (no elevated DDL access needed). Safe to re-run:
 * it skips rows that already have first_author set.
 *
 * Run:  node scripts/backfill-bibliography-structured.mjs
 *   (loads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from --env-file)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Crossref: bare DOI → { authorStr, venue }. Polite-pool contact in UA.
async function crossref(doi) {
  const bare = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  if (!bare) return null;
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(bare)}`, {
      headers: { "User-Agent": "winded.vertigo bibliography backfill (garrett@windedvertigo.com)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const m = json?.message;
    if (!m) return null;
    const authorList = Array.isArray(m.author)
      ? m.author
          .map((a) => {
            const family = a.family ?? "";
            const given = a.given ?? "";
            return family ? `${family}${given ? `, ${given}` : ""}` : (a.name ?? "");
          })
          .filter(Boolean)
      : [];
    const venue = Array.isArray(m["container-title"]) ? m["container-title"][0] ?? null : null;
    return { authorList, venue };
  } catch {
    return null;
  }
}

// Heuristic first-author from a full APA citation: leading text up to "(year)"
// or the first sentence-ending period. Returns the leading surname for sort.
function parseFirstAuthor(citation) {
  if (!citation) return null;
  // cut at the year-in-parens, else at the first ". "
  const yearCut = citation.split(/\(\d{4}/)[0];
  const lead = (yearCut && yearCut.length < citation.length ? yearCut : citation.split(". ")[0]) ?? "";
  const token = lead.trim().split(/[,\s]/)[0];
  return token || null;
}

async function main() {
  const { data: rows, error } = await sb
    .from("bibliography")
    .select("id, full_citation, doi, first_author")
    .limit(5000);
  if (error) {
    console.error("read failed:", error.message);
    process.exit(1);
  }

  let enrichedFromDoi = 0;
  let parsedLeadAuthor = 0;
  let skipped = 0;

  for (const r of rows ?? []) {
    if (r.first_author) {
      skipped++;
      continue; // already backfilled
    }

    let authors = null;
    let firstAuthor = null;
    let journal = null;

    if (r.doi) {
      const meta = await crossref(r.doi);
      if (meta && (meta.authorList.length || meta.venue)) {
        authors = meta.authorList.length ? meta.authorList : null;
        firstAuthor = meta.authorList[0] ? meta.authorList[0].split(/[,\s]/)[0] : null;
        journal = meta.venue;
        enrichedFromDoi++;
      }
      // polite-pool pacing
      await new Promise((res) => setTimeout(res, 120));
    }

    if (!firstAuthor) {
      firstAuthor = parseFirstAuthor(r.full_citation);
      if (firstAuthor) parsedLeadAuthor++;
    }

    if (!authors && !firstAuthor && !journal) continue;

    const patch = {};
    if (authors) patch.authors = authors;
    if (firstAuthor) patch.first_author = firstAuthor;
    if (journal) patch.journal = journal;

    const { error: upErr } = await sb.from("bibliography").update(patch).eq("id", r.id);
    if (upErr) console.warn(`update ${r.id} failed:`, upErr.message);
  }

  console.log(
    `backfill done — ${rows?.length ?? 0} rows · ${enrichedFromDoi} enriched from Crossref · ` +
      `${parsedLeadAuthor} lead-author parsed · ${skipped} already done`,
  );
}

main();
