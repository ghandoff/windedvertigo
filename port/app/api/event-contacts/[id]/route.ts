/**
 * PATCH  /api/event-contacts/[id] — update status or notes.
 * DELETE /api/event-contacts/[id] — unlink a contact from an event.
 *
 * Phase 7 (conference intelligence).
 *
 * Status transitions handled in updateEventContactStatus:
 *  - target → met         stamps met_at = now() (idempotent)
 *  - met → followed_up    stamps followed_up_at = now() (idempotent)
 *  - any → dropped        no stamps cleared (preserves audit trail)
 *
 * Auto follow-up task on `met`: deferred. The tasks table still lives in
 * Notion; once tasks-on-supabase ships we'll create
 * { title: "follow up with {contactName} from {eventName}",
 *   due_at: event_end + 7d, assigned_to: addedBy, linked_event_id: eventId }
 * here on the met transition. For now we log the intent.
 */

import { NextRequest } from "next/server";
import {
  updateEventContactStatus,
  unlinkContactFromEvent,
  type ContactAttendanceStatus,
} from "@/lib/supabase/event-contacts";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

const VALID_STATUSES: ContactAttendanceStatus[] = [
  "target",
  "met",
  "followed_up",
  "dropped",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return error("invalid body");

  const patch: { status?: ContactAttendanceStatus; notes?: string } = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return error(`invalid status: ${body.status}`);
    }
    patch.status = body.status;
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") return error("notes must be a string");
    patch.notes = body.notes;
  }

  if (patch.status === undefined && patch.notes === undefined) {
    return error("nothing to update");
  }

  try {
    const updated = await updateEventContactStatus(id, patch);

    // Auto follow-up task creation deferred until Supabase tasks table
    // exists. See file header for the planned shape.
    if (patch.status === "met") {
      console.log(
        `[event-contacts] would create follow-up task — ` +
          `defer until tasks-on-supabase is ready (link=${id})`,
      );
    }

    return json(updated);
  } catch (err) {
    console.error("[event-contacts] PATCH failed:", err);
    return error("failed to update event contact", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id } = await params;
  try {
    await unlinkContactFromEvent(id);
    return json({ deleted: true });
  } catch (err) {
    console.error("[event-contacts] DELETE failed:", err);
    return error("failed to unlink contact", 500);
  }
}
