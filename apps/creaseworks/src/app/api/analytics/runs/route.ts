/**
 * GET /api/analytics/runs
 *
 * Returns aggregate run analytics for the authenticated user.
 * Respects the same visibility model as the runs list.
 *
 * MVP 7 — run analytics dashboard.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { getAnalytics } from "@/lib/queries/analytics";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const analytics = await getAnalytics(session);
    return NextResponse.json(analytics);
  } catch (err: any) {
    console.error("[analytics] query failed:", err);
    return NextResponse.json(
      { error: err.message ?? "unknown error" },
      { status: 500 },
    );
  }
}
