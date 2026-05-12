/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 * Job-queue side effect preserved for status transitions.
 */
import { NextRequest } from "next/server";
import {
  getTimesheetByIdFromSupabase,
  upsertTimesheetToSupabase,
  deleteTimesheetFromSupabase,
} from "@/lib/supabase/timesheets";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import type { TimesheetStatusJob } from "@windedvertigo/job-queue/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const ts = await getTimesheetByIdFromSupabase(id);
    if (!ts) return error("Timesheet not found", 404);
    return json(ts);
  } catch (err) {
    console.error("[api/timesheets/[id]] GET failed:", err);
    return error("failed to load timesheet", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  // Capture previous status before update (only if status is changing)
  let previousStatus: string | undefined;
  if (body.status) {
    try {
      const before = await getTimesheetByIdFromSupabase(id);
      previousStatus = before?.status;
    } catch {
      // If we can't read the previous state, proceed without it
    }
  }

  try {
    const patch: Record<string, unknown> = {};
    if (body.entry !== undefined) patch.entry = body.entry;
    if (body.personIds !== undefined) patch.person_ids = body.personIds;
    if (body.dateAndTime !== undefined) {
      patch.date_start = body.dateAndTime?.start ?? null;
      patch.date_end = body.dateAndTime?.end ?? null;
    }
    if (body.hours !== undefined) patch.hours = body.hours;
    if (body.minutes !== undefined) patch.minutes = body.minutes;
    if (body.status !== undefined) patch.status = body.status;
    if (body.type !== undefined) patch.type = body.type;
    if (body.taskIds !== undefined) patch.task_ids = body.taskIds;
    if (body.meetingIds !== undefined) patch.meeting_ids = body.meetingIds;
    if (body.billable !== undefined) patch.billable = body.billable;
    if (body.rate !== undefined) patch.rate = body.rate;
    if (body.amount !== undefined) patch.amount = body.amount;
    if (body.explanation !== undefined) patch.explanation = body.explanation;

    await upsertTimesheetToSupabase(id, patch);

    // Fire job on meaningful status transitions (fire-and-forget)
    // G.2.3: CF Workers -> CF Queue; Vercel canary -> Inngest fallback
    if (body.status && body.status !== previousStatus) {
      const approverEmail = await getCallerEmail(req);
      const timesheetPayload: TimesheetStatusJob = {
        type: "timesheet/status-changed",
        timesheetId: id,
        newStatus: body.status,
        previousStatus,
        approverEmail,
        changedAt: new Date().toISOString(),
      };
      const { env } = getCloudflareContext();
      publishJob(env.TIMESHEET_QUEUE, timesheetPayload).catch((err) => {
        console.warn("[timesheets] failed to enqueue status job:", err);
      });
    }

    const updated = await getTimesheetByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/timesheets/[id]] PATCH failed:", err);
    return error("failed to update timesheet", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteTimesheetFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/timesheets/[id]] DELETE failed:", err);
    return error("failed to delete timesheet", 500);
  }
}

// -- helpers --

async function getCallerEmail(req: NextRequest): Promise<string> {
  try {
    const session = await auth();
    return session?.user?.email ?? "system";
  } catch {
    return "system";
  }
}
