/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getCampaignsFromSupabase,
  upsertCampaignToSupabase,
} from "@/lib/supabase/campaigns";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const status = param(req, "status") ?? undefined;
  const type = param(req, "type") ?? undefined;
  const search = param(req, "search") ?? undefined;

  try {
    const data = await getCampaignsFromSupabase(status, type, search);
    return json({ data, nextCursor: null, hasMore: false });
  } catch (err) {
    console.error("[api/campaigns] Supabase query failed:", err);
    return error("failed to load campaigns", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  try {
    const id = crypto.randomUUID();
    await upsertCampaignToSupabase(id, {
      name: body.name,
      type: body.type ?? "email",
      status: body.status ?? "draft",
      event_ids: body.eventIds ?? [],
      audience_filters: body.audienceFilters ?? {},
      owner: body.owner ?? null,
      start_date: body.startDate?.start ?? null,
      end_date: body.endDate?.start ?? null,
      notes: body.notes ?? null,
    });

    return json({
      id,
      name: body.name,
      type: body.type ?? "email",
      status: body.status ?? "draft",
      eventIds: body.eventIds ?? [],
      audienceFilters: body.audienceFilters ?? {},
      owner: body.owner ?? "",
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      notes: body.notes ?? "",
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/campaigns] POST failed:", err);
    return error("failed to create campaign", 500);
  }
}
