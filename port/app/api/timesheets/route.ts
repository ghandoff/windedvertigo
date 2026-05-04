/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getTimesheetsFromSupabase,
  upsertTimesheetToSupabase,
} from "@/lib/supabase/timesheets";
import { json, error, param, boolParam } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const status = param(req, "status") ?? undefined;
  const personId = param(req, "personId") ?? undefined;
  const dateAfter = param(req, "dateAfter") ?? undefined;
  const dateBefore = param(req, "dateBefore") ?? undefined;

  try {
    const data = await getTimesheetsFromSupabase(status, personId, dateAfter, dateBefore);
    return json({ data, nextCursor: null, hasMore: false });
  } catch (err) {
    console.error("[api/timesheets] Supabase query failed:", err);
    return error("failed to load timesheets", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.entry) return error("entry (description) is required");

  try {
    const id = crypto.randomUUID();
    await upsertTimesheetToSupabase(id, {
      entry: body.entry,
      person_ids: body.personIds ?? [],
      date_start: body.dateAndTime?.start ?? null,
      date_end: body.dateAndTime?.end ?? null,
      hours: body.hours ?? null,
      minutes: body.minutes ?? null,
      status: body.status ?? "draft",
      type: body.type ?? "time",
      task_ids: body.taskIds ?? [],
      meeting_ids: body.meetingIds ?? [],
      billable: body.billable ?? false,
      rate: body.rate ?? null,
      amount: body.amount ?? null,
      explanation: body.explanation ?? null,
    });

    return json({
      id,
      entry: body.entry,
      personIds: body.personIds ?? [],
      dateAndTime: body.dateAndTime ?? null,
      hours: body.hours ?? null,
      minutes: body.minutes ?? null,
      status: body.status ?? "draft",
      type: body.type ?? "time",
      taskIds: body.taskIds ?? [],
      meetingIds: body.meetingIds ?? [],
      billable: body.billable ?? false,
      rate: body.rate ?? null,
      amount: body.amount ?? null,
      explanation: body.explanation ?? "",
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/timesheets] POST failed:", err);
    return error("failed to create timesheet", 500);
  }
}
