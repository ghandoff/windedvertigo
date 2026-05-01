/**
 * Supabase read layer for content calendar drafts.
 *
 * Reads from the `social_drafts` table (synced every 4h by sync-social-pilot)
 * rather than Notion's optional contentCalendar DB. Matches the shape that
 * the ops marketing module already uses so both surfaces stay in sync.
 */

import { supabase } from "@/lib/supabase/client";
import type { ContentDraft, ContentStatus, ContentChannel } from "@/lib/notion/content";

interface SocialDraftRow {
  notion_page_id: string;
  content: string;
  platform: string | null;
  status: string | null;
  scheduled_for: string | null;
  updated_at: string;
}

function rowToContentDraft(row: SocialDraftRow): ContentDraft {
  return {
    id: row.notion_page_id,
    title: (row.content ?? "").slice(0, 80) || "untitled draft",
    channel: ((row.platform ?? "linkedin") as ContentChannel),
    body: row.content || undefined,
    scheduledDate: row.scheduled_for ? row.scheduled_for.slice(0, 10) : undefined,
    status: ((row.status ?? "draft") as ContentStatus),
  };
}

export async function getContentDraftsFromSupabase(): Promise<ContentDraft[]> {
  const { data, error } = await supabase
    .from("social_drafts")
    .select("notion_page_id, content, platform, status, scheduled_for, updated_at")
    .neq("status", "published")
    .order("scheduled_for", { ascending: true })
    .limit(30);

  if (error) throw error;
  return (data as unknown as SocialDraftRow[]).map(rowToContentDraft);
}
