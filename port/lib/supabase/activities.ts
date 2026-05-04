/**
 * Supabase read layer for activities — used when ACTIVITIES_SOURCE=supabase.
 *
 * Maps Supabase rows back to the canonical `Activity` type from lib/notion/types.
 * Critically: `id` is set to `notion_page_id` (not the Supabase UUID) so all
 * callers that match against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { Activity, ActivityType, ActivityOutcome } from "@/lib/notion/types";

interface ActivityRow {
  notion_page_id: string;
  activity: string;
  type: string | null;
  date: string | null;
  outcome: string | null;
  notes: string | null;
  logged_by: string | null;
  organization_ids: string[];
  contact_ids: string[];
}

function mapRowToActivity(row: ActivityRow): Activity {
  return {
    id: row.notion_page_id,
    activity: row.activity,
    type: (row.type as ActivityType) ?? ("other" as ActivityType),
    contactIds: row.contact_ids ?? [],
    organizationIds: row.organization_ids ?? [],
    eventIds: [],
    date: row.date ? { start: row.date, end: null } : null,
    outcome: (row.outcome as ActivityOutcome) ?? ("neutral" as ActivityOutcome),
    notes: row.notes ?? "",
    loggedBy: row.logged_by ?? "",
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, activity, type, date, outcome, notes, logged_by, organization_ids, contact_ids";

export async function getActivityByIdFromSupabase(notionPageId: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from("activities")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .maybeSingle();
  if (error) throw new Error(`[supabase/activities] getById: ${error.message}`);
  return data ? mapRowToActivity(data as ActivityRow) : null;
}

export async function getActivitiesFromSupabase(orgId?: string, contactId?: string): Promise<Activity[]> {
  let query = supabase.from("activities").select(SELECT_COLS).order("date", { ascending: false });

  if (orgId) {
    query = query.contains("organization_ids", [orgId]);
  }
  if (contactId) {
    query = query.contains("contact_ids", [contactId]);
  }

  const { data, error } = await query;

  if (error) throw new Error(`[supabase/activities] getActivities: ${error.message}`);
  return (data as ActivityRow[]).map(mapRowToActivity);
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert an activity. Uses notion_page_id as the conflict target.
 */
export async function upsertActivityToSupabase(
  notionPageId: string,
  data: Partial<Omit<ActivityRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/activities] upsert: ${error.message}`);
}

/**
 * Delete an activity row.
 */
export async function deleteActivityFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/activities] delete: ${error.message}`);
}
