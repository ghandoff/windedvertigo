/**
 * /api/cmo/timeline-items — data backing the /mo "timeline" tab's multi-view
 * Gantt (cmo_timeline_items).
 *
 * GET: all items. Readable by either a signed-in session OR the agent bearer
 *   token (CMO_API_TOKEN), mirroring the existing /api/cmo/* pattern.
 * POST: create an item. Agent-seeded only (bearer token) — v1 has no in-UI
 *   editing (see docs/prompts/strategy-brief-tab-port-build.md, "timeline
 *   tab" section: "agent-seeded via bearer is fine for v1").
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import {
  getTimelineItems,
  createTimelineItem,
  type TimelineItemKind,
} from "@/lib/supabase/cmo-timeline-items";

const VALID_KINDS: TimelineItemKind[] = ["task", "milestone", "critical", "active"];

function hasBearerAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  const session = await auth().catch(() => null);
  if (!session?.user?.email && !hasBearerAuth(req)) return error("unauthorized", 401);

  try {
    const items = await getTimelineItems();
    return json(items);
  } catch (err) {
    console.error("[api/cmo/timeline-items] GET failed:", err);
    return error("failed to load timeline items", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!hasBearerAuth(req)) return error("unauthorized — agent bearer token required", 401);

  const body = await req.json().catch(() => null);
  if (!body?.label) return error("label is required");
  if (!body?.lane) return error("lane is required");
  if (!body?.start_date) return error("start_date is required");
  if (!body?.updated_by) return error("updated_by is required");
  if (body.kind && !VALID_KINDS.includes(body.kind)) {
    return error(`kind must be one of ${VALID_KINDS.join(", ")}`);
  }

  try {
    const result = await createTimelineItem({
      label: body.label,
      lane: body.lane,
      owner: body.owner,
      horizon: body.horizon,
      track: body.track,
      kind: body.kind,
      start_date: body.start_date,
      end_date: body.end_date,
      sort: body.sort,
      updated_by: body.updated_by,
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/cmo/timeline-items] POST failed:", err);
    return error("failed to create timeline item", 500);
  }
}
