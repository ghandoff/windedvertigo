/**
 * Supabase read/write for `meeting_action_items` (Council W1).
 *
 * Action items extracted from meeting summaries via lib/ai/meeting-actions.ts
 * extractMeetingActions(). The /council "My Actions" tab + wv-claw's
 * getMeetingActions tool read from here.
 */

import { supabase } from "./client";

export type ActionPriority = "low" | "medium" | "high";
export type ActionType = "plan" | "implement" | "coordinate" | "review" | "admin";
export type ActionStatus = "open" | "done" | "cancelled";

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  ownerEmail: string | null;
  ownerName: string | null;
  deadline: string | null;
  priority: ActionPriority | null;
  type: ActionType | null;
  context: string | null;
  status: ActionStatus;
  workItemId: string | null;
}

interface ActionRow {
  id: string;
  meeting_id: string;
  created_at: string;
  updated_at: string;
  title: string;
  owner_email: string | null;
  owner_name: string | null;
  deadline: string | null;
  priority: ActionPriority | null;
  type: ActionType | null;
  context: string | null;
  status: ActionStatus;
  work_item_id: string | null;
}

function mapRow(row: ActionRow): MeetingActionItem {
  return {
    id:          row.id,
    meetingId:   row.meeting_id,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    title:       row.title,
    ownerEmail:  row.owner_email,
    ownerName:   row.owner_name,
    deadline:    row.deadline,
    priority:    row.priority,
    type:        row.type,
    context:     row.context,
    status:      row.status,
    workItemId:  row.work_item_id,
  };
}

export interface CreateActionInput {
  meetingId: string;
  title: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
  deadline?: string | null;
  priority?: ActionPriority | null;
  type?: ActionType | null;
  context?: string | null;
  workItemId?: string | null;
}

/** Batch-insert action items for a meeting. Returns the count of rows written. */
export async function createActionItems(items: CreateActionInput[]): Promise<number> {
  if (items.length === 0) return 0;
  try {
    const rows = items.map((i) => ({
      meeting_id:   i.meetingId,
      title:        i.title,
      owner_email:  i.ownerEmail ?? null,
      owner_name:   i.ownerName ?? null,
      deadline:     i.deadline ?? null,
      priority:     i.priority ?? null,
      type:         i.type ?? null,
      context:      i.context ?? null,
      work_item_id: i.workItemId ?? null,
    }));
    const { data, error } = await supabase.from("meeting_action_items").insert(rows).select("id");
    if (error) {
      console.warn("[supabase/meeting-action-items] insert failed:", error.message);
      return 0;
    }
    return data?.length ?? 0;
  } catch (err) {
    console.warn("[supabase/meeting-action-items] insert threw:", err instanceof Error ? err.message : err);
    return 0;
  }
}

/** "My open actions" view — returns all open items for a user across all meetings. */
export async function listOpenActionsForOwner(
  ownerEmail: string,
  limit = 100,
): Promise<MeetingActionItem[]> {
  try {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .select("*")
      .eq("owner_email", ownerEmail.toLowerCase())
      .eq("status", "open")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.warn("[supabase/meeting-action-items] list-owner failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRow(r as ActionRow));
  } catch (err) {
    console.warn("[supabase/meeting-action-items] list-owner threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** All actions for a specific meeting, oldest first (preserves extraction order). */
export async function listActionsForMeeting(meetingId: string): Promise<MeetingActionItem[]> {
  try {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[supabase/meeting-action-items] list-meeting failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRow(r as ActionRow));
  } catch (err) {
    console.warn("[supabase/meeting-action-items] list-meeting threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Plain-text search over action title + context. Case-insensitive. Used by
 * the council search tab alongside meeting-summary search.
 */
export async function searchActionItems(
  query: string,
  limit = 25,
): Promise<MeetingActionItem[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .select("*")
      .or(`title.ilike.%${q}%,context.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[supabase/meeting-action-items] search failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRow(r as ActionRow));
  } catch (err) {
    console.warn(
      "[supabase/meeting-action-items] search threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Link a meeting action to its promoted Notion work_item. Called by the
 * promote-to-work_item route after a work_item is created. Idempotent —
 * overwrites work_item_id if it was set previously.
 */
export async function setActionWorkItemId(
  id: string,
  workItemId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("meeting_action_items")
      .update({ work_item_id: workItemId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.warn("[supabase/meeting-action-items] setWorkItemId failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "[supabase/meeting-action-items] setWorkItemId threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** Read one action item by id (used by promote route to fetch the source). */
export async function getActionItem(id: string): Promise<MeetingActionItem | null> {
  try {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[supabase/meeting-action-items] get failed:", error.message);
      return null;
    }
    return data ? mapRow(data as ActionRow) : null;
  } catch (err) {
    console.warn(
      "[supabase/meeting-action-items] get threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Toggle an action's status. Returns true on success. */
export async function updateActionStatus(
  id: string,
  status: ActionStatus,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("meeting_action_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.warn("[supabase/meeting-action-items] update failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[supabase/meeting-action-items] update threw:", err instanceof Error ? err.message : err);
    return false;
  }
}
