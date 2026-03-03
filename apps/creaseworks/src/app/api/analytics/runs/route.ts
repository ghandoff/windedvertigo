/**
 * GET /api/analytics/runs
 *
 * Returns aggregate run analytics for the authenticated user.
 * Respects the same visibility model as the runs list.
 *
 * Admin users additionally receive platform-level metrics:
 * user growth, pack adoption, credit economy, conversion funnel.
 *
 * MVP 7 → Phase 2: enriched admin analytics.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { getAnalytics, getAdminAnalytics } from "@/lib/queries/analytics";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const analytics = await getAnalytics(session);

    // Admins get platform-level metrics too
    if (session.isAdmin) {
      const admin = await getAdminAnalytics();
      return NextResponse.json({ ...analytics, admin });
    }

    return NextResponse.json(analytics);
  } catch (err: any) {
    console.error("[analytics] query failed:", err);
    return NextResponse.json(
      { error: "analytics query failed" },
      { status: 500 },
    );
  }
}
