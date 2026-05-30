/**
 * GET /api/analytics/harbour
 *
 * Returns harbour-wide L2 business analytics as JSON.
 * Auth-gated: requires an active (dashboard) session.
 *
 * Query params:
 *   ?app=<slug>  — optional harbour app slug to scope purchase/entitlement
 *                  metrics (e.g. "creaseworks", "depth-chart", "vertigo-vault").
 *                  Omit for harbour-wide rollup.
 *
 * Response: HarbourAnalytics JSON (see port/lib/neon/harbour-analytics.ts)
 *
 * Note: this endpoint exists as a service layer for future client-side
 * refreshes. The (dashboard)/harbour page fetches data server-side directly
 * (no HTTP round-trip) using getHarbourAnalytics() directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHarbourAnalytics } from "@/lib/neon/harbour-analytics";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const app = req.nextUrl.searchParams.get("app") ?? undefined;
  const data = await getHarbourAnalytics(app);

  return NextResponse.json(data);
}
