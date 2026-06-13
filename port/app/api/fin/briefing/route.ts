/**
 * GET  /api/fin/briefing — assembled JSON: latest snapshot per type + open
 *      fin_items + patterns due within 30 days + recent decisions.
 * POST /api/fin/briefing — accepts a briefing payload and upserts all
 *      snapshot types in one call (fin_briefing Cowork tool pushes here).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import {
  getLatestSnapshots,
  getOpenFinItems,
  getUpcomingDeadlines,
  getRecentDecisions,
  getFinMemory,
  upsertSnapshot,
  type FinSnapshotType,
} from "@/lib/fin-data";

const SNAPSHOT_TYPES: FinSnapshotType[] = [
  "p_and_l",
  "balance_sheet",
  "cash_flow",
  "ap_aging",
  "ar_aging",
  "payroll",
  "briefing",
];

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const [snapshots, openItems, upcomingDeadlines, recentDecisions, memory] =
      await Promise.all([
        getLatestSnapshots(),
        getOpenFinItems(),
        getUpcomingDeadlines(30),
        getRecentDecisions(10),
        getFinMemory(),
      ]);

    // most recent fetched_at across all snapshots
    const lastFetchedAt = Object.values(snapshots)
      .map((s) => s?.fetched_at ?? "")
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return json({
      snapshots,
      open_items: openItems,
      upcoming_deadlines: upcomingDeadlines,
      recent_decisions: recentDecisions,
      memory,
      last_fetched_at: lastFetchedAt,
      open_items_count: openItems.length,
      upcoming_count: upcomingDeadlines.length,
    });
  } catch (err) {
    console.error("[api/fin/briefing] GET failed:", err);
    return error("failed to load briefing", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return error("request body is required");

  const upserted: string[] = [];
  const errors: string[] = [];

  for (const type of SNAPSHOT_TYPES) {
    if (!body[type]) continue;
    try {
      await upsertSnapshot({
        snapshot_type: type,
        data: body[type],
        period_label: body[`${type}_period`] ?? undefined,
        fetched_at: body.fetched_at ?? new Date().toISOString(),
      });
      upserted.push(type);
    } catch (e) {
      errors.push(`${type}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  if (upserted.length === 0 && errors.length > 0) {
    return error(`all snapshot upserts failed: ${errors.join("; ")}`, 500);
  }

  return json({ upserted, errors, count: upserted.length }, errors.length ? 207 : 201);
}
