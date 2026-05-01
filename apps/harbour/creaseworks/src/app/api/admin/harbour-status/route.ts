/**
 * GET /api/admin/harbour-status
 *
 * Returns cross-platform health metrics for the harbour admin dashboard.
 * Admin-only — no scoped visibility, shows the full picture.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { getHarbourStatus } from "@/lib/queries/harbour-status";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const status = await getHarbourStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[harbour-status] query failed:", err);
    return NextResponse.json(
      { error: "harbour status query failed" },
      { status: 500 },
    );
  }
}
