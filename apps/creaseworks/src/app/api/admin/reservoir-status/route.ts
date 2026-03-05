/**
 * GET /api/admin/reservoir-status
 *
 * Returns cross-platform health metrics for the reservoir admin dashboard.
 * Admin-only — no scoped visibility, shows the full picture.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { getReservoirStatus } from "@/lib/queries/reservoir-status";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const status = await getReservoirStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[reservoir-status] query failed:", err);
    return NextResponse.json(
      { error: "reservoir status query failed" },
      { status: 500 },
    );
  }
}
