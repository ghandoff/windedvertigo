/**
 * GET  /api/event-contacts?eventId=... — list links for an event.
 * POST /api/event-contacts              — link a contact to an event.
 *
 * Phase 7 (conference intelligence).
 *
 * Auth: any signed-in @windedvertigo.com user. We use session.user.email
 * as `added_by` so we know which collective member queued the target.
 *
 * Note on auto follow-up tasks: when a link transitions to `met` we'd
 * normally create a follow-up task (due event_end + 7 days). The Supabase
 * tasks table doesn't yet exist (tasks still live in Notion); auto-task
 * creation is deferred until tasks-on-supabase ships. See PATCH handler
 * for the deferral log line.
 */

import { NextRequest } from "next/server";
import {
  listContactsByEvent,
  linkContactToEvent,
} from "@/lib/supabase/event-contacts";
import { json, error, param } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const eventId = param(req, "eventId");
  if (!eventId) return error("eventId is required");

  try {
    const contacts = await listContactsByEvent(eventId);
    return json({ contacts });
  } catch (err) {
    console.error("[event-contacts] GET failed:", err);
    return error("failed to list event contacts", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.eventId || !body?.contactId) {
    return error("eventId and contactId are required");
  }

  try {
    const created = await linkContactToEvent({
      eventId: body.eventId,
      contactId: body.contactId,
      addedBy: session.user.email,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return json(created, 201);
  } catch (err) {
    // Postgres unique_violation = 23505. Surface a 409 with the existing
    // row's id so the UI can swap to it without forcing a refetch.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("23505") || message.includes("duplicate key")) {
      try {
        const { data } = await supabase
          .from("crm_event_contacts")
          .select("id")
          .eq("event_id", body.eventId)
          .eq("contact_id", body.contactId)
          .single();
        return json(
          { error: "already linked", existingId: data?.id ?? null },
          409,
        );
      } catch (lookupErr) {
        console.error("[event-contacts] existing-id lookup failed:", lookupErr);
        return json({ error: "already linked", existingId: null }, 409);
      }
    }
    console.error("[event-contacts] POST failed:", err);
    return error("failed to link contact", 500);
  }
}
