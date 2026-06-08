/**
 * Backfill bibliography.title from Crossref for rows that have a DOI but no
 * title yet. Non-DOI rows are left null (the UI falls back to parsing the
 * citation). DML only — runs through the service key. Safe to re-run.
 *
 * Run AFTER migration 20260608_bibliography_title.sql is applied:
 *   node --env-file=<env> scripts/backfill-bibliography-title.mjs
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) { console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY"); process.exit(1); }
const sb = createClient(URL, KEY);

async function crossrefTitle(doi) {
  const bare = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  if (!bare) return null;
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(bare)}`, {
      headers: { "User-Agent": "winded.vertigo bibliography backfill (garrett@windedvertigo.com)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const t = json?.message?.title;
    return Array.isArray(t) ? t[0]?.trim() || null : null;
  } catch {
    return null;
  }
}

async function main() {
  const { data: rows, error } = await sb
    .from("bibliography")
    .select("id, doi, title")
    .is("title", null)
    .not("doi", "is", null)
    .limit(5000);
  if (error) { console.error("read failed:", error.message); process.exit(1); }

  let set = 0;
  for (const r of rows ?? []) {
    const title = await crossrefTitle(r.doi);
    await new Promise((res) => setTimeout(res, 120)); // polite pacing
    if (!title) continue;
    const { error: upErr } = await sb.from("bibliography").update({ title }).eq("id", r.id);
    if (upErr) console.warn(`update ${r.id} failed:`, upErr.message);
    else set++;
  }
  console.log(`title backfill done — ${rows?.length ?? 0} DOI rows missing title · ${set} titles set`);
}

main();
