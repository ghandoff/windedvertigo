/**
 * Supabase read layer for timesheets — used by the agent's queryTimesheetsTool.
 *
 * date_start/date_end stored as TEXT (ISO date string) for simple range filtering.
 * person_ids is TEXT[] so .contains() works without split/join.
 */

import { supabase } from "./client";
import type { Timesheet } from "@/lib/notion/types";

interface TimesheetRow {
  notion_page_id: string;
  entry: string;
  person_ids: string[];
  date_start: string | null;
  date_end: string | null;
  hours: number | null;
  minutes: number | null;
  status: string | null;
  type: string | null;
  task_ids: string[];
  meeting_ids: string[];
  billable: boolean;
  rate: number | null;
  amount: number | null;
  explanation: string | null;
}

function mapRowToTimesheet(row: TimesheetRow): Timesheet {
  return {
    id: row.notion_page_id,
    entry: row.entry,
    personIds: row.person_ids ?? [],
    dateAndTime: row.date_start ? { start: row.date_start, end: row.date_end ?? null } : null,
    hours: row.hours ?? null,
    minutes: row.minutes ?? null,
    status: (row.status as Timesheet["status"]) ?? "draft",
    type: (row.type === "reimbursement" ? "reimbursement" : "time") as Timesheet["type"],
    taskIds: row.task_ids ?? [],
    meetingIds: row.meeting_ids ?? [],
    billable: row.billable ?? false,
    rate: row.rate ?? null,
    amount: row.amount ?? null,
    explanation: row.explanation ?? "",
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, entry, person_ids, date_start, date_end, hours, minutes, status, type, task_ids, meeting_ids, billable, rate, amount, explanation";

export async function getTimesheetsFromSupabase(
  status?: string,
  personId?: string,
  dateAfter?: string,
  dateBefore?: string,
): Promise<Timesheet[]> {
  let query = supabase.from("timesheets").select(SELECT_COLS);

  if (status) query = query.eq("status", status);
  if (personId) query = query.contains("person_ids", [personId]);
  if (dateAfter) query = query.gte("date_start", dateAfter);
  if (dateBefore) query = query.lte("date_start", dateBefore);

  query = query.order("date_start", { ascending: false, nullsFirst: false });

  const { data, error } = await query;

  if (error)
    throw new Error(`[supabase/timesheets] getTimesheetsFromSupabase: ${error.message}`);
  return (data as TimesheetRow[]).map(mapRowToTimesheet);
}

export async function getTimesheetByIdFromSupabase(
  notionPageId: string,
): Promise<Timesheet | null> {
  const { data, error } = await supabase
    .from("timesheets")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/timesheets] getById: ${error.message}`);
  }
  return data ? mapRowToTimesheet(data as TimesheetRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert a timesheet entry. Uses notion_page_id as the conflict target.
 */
export async function upsertTimesheetToSupabase(
  notionPageId: string,
  data: Partial<Omit<TimesheetRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("timesheets")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/timesheets] upsert: ${error.message}`);
}

/**
 * Delete a timesheet row.
 */
export async function deleteTimesheetFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("timesheets")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/timesheets] delete: ${error.message}`);
}
