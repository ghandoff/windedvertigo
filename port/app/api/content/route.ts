/**
 * GET /api/content — list content calendar drafts
 * POST /api/content — create a draft (writes to Notion contentCalendar DB if configured)
 *
 * Phase G.1.3: GET reads from Supabase `social_drafts` table.
 * The social_drafts table is kept current by sync-social-pilot (every 4h).
 * POST still writes to Notion — source of truth.
 */

import { NextRequest } from "next/server";
import { getContentDraftsFromSupabase } from "@/lib/supabase/content";
import { createContentDraft } from "@/lib/notion/content";
import { json, error, withNotionError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const items = await getContentDraftsFromSupabase();
    return json({ items });
  } catch (err) {
    console.error("[api/content] Supabase query failed:", err);
    return json({ items: [], error: "failed to load drafts" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.title) return error("title is required");
  if (!body?.channel) return error("channel is required");

  return withNotionError(async () => {
    const draft = await createContentDraft(body);
    if (!draft) return error("content calendar DB not configured — set NOTION_CONTENT_CALENDAR_DB_ID", 503);
    return json(draft, 201);
  });
}
