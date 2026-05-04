/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */

import { NextRequest } from "next/server";
import {
  getCompetitorsFromSupabase,
  upsertCompetitorToSupabase,
  type CompetitorSupabaseFilters,
} from "@/lib/supabase/competitors";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: CompetitorSupabaseFilters = {};
  if (param(req, "type")) filters.type = param(req, "type");
  if (param(req, "threatLevel")) filters.threatLevel = param(req, "threatLevel");
  if (param(req, "quadrantOverlap")) filters.quadrantOverlap = param(req, "quadrantOverlap");
  if (param(req, "geography")) filters.geography = param(req, "geography");
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 50;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getCompetitorsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/competitors] Supabase query failed:", err);
    return error("failed to load competitors", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organisation) return error("organisation (name) is required");

  try {
    const id = crypto.randomUUID();
    await upsertCompetitorToSupabase(id, {
      organisation: body.organisation,
      type: body.type ?? null,
      threat_level: body.threatLevel ?? null,
      quadrant_overlap: body.quadrantOverlap ?? [],
      geography: body.geography ?? [],
      what_they_offer: body.whatTheyOffer ?? null,
      where_wv_wins: body.whereWvWins ?? null,
      relevance_to_wv: body.relevanceToWv ?? null,
      notes: body.notes ?? null,
      url: body.url ?? null,
      organization_ids: body.organizationIds ?? [],
      updated_at: new Date().toISOString(),
    });

    return json({
      id,
      organisation: body.organisation,
      type: body.type ?? "",
      threatLevel: body.threatLevel ?? "",
      quadrantOverlap: body.quadrantOverlap ?? [],
      geography: body.geography ?? [],
      whatTheyOffer: body.whatTheyOffer ?? "",
      whereWvWins: body.whereWvWins ?? "",
      relevanceToWv: body.relevanceToWv ?? "",
      notes: body.notes ?? "",
      url: body.url ?? "",
      organizationIds: body.organizationIds ?? [],
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/competitors] POST failed:", err);
    return error("failed to create competitor", 500);
  }
}
