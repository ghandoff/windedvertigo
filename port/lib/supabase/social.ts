/**
 * Supabase read layer for social drafts — used when SOCIAL_SOURCE=supabase.
 *
 * Maps Supabase rows back to the canonical `SocialDraft` type from lib/notion/types.
 * Critically: `id` is set to `notion_page_id` (not the Supabase UUID) so all
 * callers that match against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { SocialDraft, SocialDraftStatus, SocialPlatform } from "@/lib/notion/types";

interface SocialRow {
  notion_page_id: string;
  content: string;
  platform: string | null;
  status: string | null;
  org_id: string | null;
  scheduled_for: string | null;
  published_url: string | null;
}

function mapRowToSocial(row: SocialRow): SocialDraft {
  return {
    id: row.notion_page_id,
    content: row.content,
    platform: (row.platform as SocialPlatform) ?? "linkedin",
    status: (row.status as SocialDraftStatus) ?? "draft",
    mediaUrls: "",
    scheduledFor: row.scheduled_for ? { start: row.scheduled_for, end: null } : null,
    organizationId: row.org_id ?? "",
    notes: "",
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, content, platform, status, org_id, scheduled_for, published_url";

export async function getSocialDraftsFromSupabase(
  status?: SocialDraftStatus,
  platform?: SocialPlatform,
): Promise<SocialDraft[]> {
  let query = supabase
    .from("social_drafts")
    .select(SELECT_COLS)
    .order("scheduled_for", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;

  if (error) throw new Error(`[supabase/social] getSocialDrafts: ${error.message}`);
  return (data as SocialRow[]).map(mapRowToSocial);
}
