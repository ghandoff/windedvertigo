/**
 * One-time backfill: copy the annotated bibliography out of Notion into the
 * Supabase `bibliography` table. Idempotent — re-running skips duplicates
 * (unique citation_key). Bearer-auth with the agent token so an admin can run it.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { queryBibliographyFromNotion } from "@/lib/notion/bibliography";
import { insertBibliographyRow, countBibliography } from "@/lib/supabase/bibliography";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const before = await countBibliography();
    const notionEntries = await queryBibliographyFromNotion();

    let inserted = 0;
    let skipped = 0;
    for (const e of notionEntries) {
      const res = await insertBibliographyRow({
        fullCitation: e.fullCitation,
        abstract: e.abstract || undefined,
        keywords: e.keywords || undefined,
        notes: e.notes || undefined,
        topic: e.topic || undefined,
        sourceType: e.sourceType || undefined,
        year: e.year ?? null,
        doi: e.doi ?? null,
        publisherLink: e.publisherLink ?? null,
        citationCount: e.citationCount ?? null,
        notionPageId: e.id,
      });
      if (res.created) inserted++;
      else skipped++;
    }

    const after = await countBibliography();
    return json({
      notion_entries: notionEntries.length,
      inserted,
      skipped,
      bibliography_before: before,
      bibliography_after: after,
    });
  } catch (err) {
    console.error("[api/carl/migrate-bibliography] failed:", err);
    return error("backfill failed", 500);
  }
}
