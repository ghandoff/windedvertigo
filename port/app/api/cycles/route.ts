/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */

import { NextRequest } from "next/server";
import {
  getCyclesFromSupabase,
  upsertCycleToSupabase,
  type CycleSupabaseFilters,
} from "@/lib/supabase/cycles";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: CycleSupabaseFilters = {};
  if (param(req, "status")) filters.status = param(req, "status");
  if (param(req, "projectId")) filters.projectId = param(req, "projectId");
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 50;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getCyclesFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/cycles] Supabase query failed:", err);
    return error("failed to load cycles", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.cycle) return error("cycle (name) is required");

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await upsertCycleToSupabase(id, {
      cycle: body.cycle,
      start_date: body.startDate?.start ?? null,
      end_date: body.endDate?.start ?? null,
      project_ids: body.projectIds ?? [],
      status: body.status ?? null,
      goal: body.goal ?? null,
      updated_at: now,
    });

    return json({
      id,
      cycle: body.cycle,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      projectIds: body.projectIds ?? [],
      status: body.status ?? null,
      goal: body.goal ?? "",
      createdTime: now,
      lastEditedTime: now,
    }, 201);
  } catch (err) {
    console.error("[api/cycles] POST failed:", err);
    return error("failed to create cycle", 500);
  }
}
