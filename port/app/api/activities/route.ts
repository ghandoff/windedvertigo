/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getActivitiesFromSupabase,
  upsertActivityToSupabase,
} from "@/lib/supabase/activities";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const contactId = param(req, "contactId") ?? undefined;
  const orgId = param(req, "orgId") ?? undefined;

  try {
    const data = await getActivitiesFromSupabase(orgId, contactId);
    return json({ data, nextCursor: null, hasMore: false });
  } catch (err) {
    console.error("[api/activities] Supabase query failed:", err);
    return error("failed to load activities", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.activity) return error("activity (description) is required");

  try {
    const id = crypto.randomUUID();
    await upsertActivityToSupabase(id, {
      activity: body.activity,
      type: body.type ?? null,
      date: body.date?.start ?? null,
      outcome: body.outcome ?? null,
      notes: body.notes ?? null,
      logged_by: body.loggedBy ?? null,
      organization_ids: body.organizationIds ?? [],
      contact_ids: body.contactIds ?? [],
    });

    return json({
      id,
      activity: body.activity,
      type: body.type ?? "other",
      contactIds: body.contactIds ?? [],
      organizationIds: body.organizationIds ?? [],
      eventIds: [],
      date: body.date ?? null,
      outcome: body.outcome ?? "neutral",
      notes: body.notes ?? "",
      loggedBy: body.loggedBy ?? "",
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/activities] POST failed:", err);
    return error("failed to create activity", 500);
  }
}
