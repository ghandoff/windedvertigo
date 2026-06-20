/**
 * GET   /api/biz/roadmap        — all roadmap items (optional ?status=planned|backlog|shipped)
 * GET   /api/biz/roadmap?available=1 — just the not-yet-built upgrades
 * PATCH /api/biz/roadmap        — flip a feature's status (e.g. mark 'shipped' when a phase lands)
 *
 * Mirror of docs/biz/feature-catalog.md. Auth: Bearer CMO_API_TOKEN.
 */

import { NextRequest } from "next/server";
import { json, error, param, boolParam } from "@/lib/api-helpers";
import {
  getRoadmap,
  getAvailableUpgrades,
  setRoadmapStatus,
  type BizRoadmapStatus,
} from "@/lib/biz-data";

const STATUSES: BizRoadmapStatus[] = ["shipped", "planned", "backlog"];

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    if (boolParam(req, "available")) {
      return json(await getAvailableUpgrades());
    }
    const status = param(req, "status") as BizRoadmapStatus | undefined;
    if (status && !STATUSES.includes(status)) return error("invalid status");
    return json(await getRoadmap(status));
  } catch (err) {
    console.error("[api/biz/roadmap] GET failed:", err);
    return error("failed to load roadmap", 500);
  }
}

export async function PATCH(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.feature_id) return error("feature_id is required");
  if (!body?.status || !STATUSES.includes(body.status)) {
    return error("status must be one of: shipped, planned, backlog");
  }

  try {
    const result = await setRoadmapStatus(body.feature_id, body.status);
    return json(result);
  } catch (err) {
    console.error("[api/biz/roadmap] PATCH failed:", err);
    return error("failed to update roadmap", 500);
  }
}
