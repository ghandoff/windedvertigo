/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getDealsFromSupabase,
  upsertDealToSupabase,
} from "@/lib/supabase/deals";
import { json, error, param } from "@/lib/api-helpers";
import type { DealStage } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const stage = param(req, "stage") as DealStage | undefined ?? undefined;
  const search = param(req, "search") ?? undefined;

  try {
    const data = await getDealsFromSupabase(stage, undefined, search);
    return json({ data, nextCursor: null, hasMore: false });
  } catch (err) {
    console.error("[api/deals] Supabase query failed:", err);
    return error("failed to load deals", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.deal) return error("deal name is required");

  try {
    const id = crypto.randomUUID();
    await upsertDealToSupabase(id, {
      deal: body.deal,
      stage: body.stage ?? "identified",
      value: body.value ?? null,
      org_ids: body.organizationIds ?? [],
      rfp_ids: body.rfpOpportunityIds ?? [],
      notes: body.notes ?? null,
      loss_reason: body.lostReason ?? null,
    });

    return json({
      id,
      deal: body.deal,
      stage: body.stage ?? "identified",
      organizationIds: body.organizationIds ?? [],
      rfpOpportunityIds: body.rfpOpportunityIds ?? [],
      owner: "",
      value: body.value ?? null,
      closeDate: null,
      lostReason: body.lostReason ?? null,
      notes: body.notes ?? "",
      documents: undefined,
      debriefWhatWorked: "",
      debriefWhatFellFlat: "",
      debriefWhatWasMissing: "",
      debriefClientFeedback: "",
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/deals] POST failed:", err);
    return error("failed to create deal", 500);
  }
}
