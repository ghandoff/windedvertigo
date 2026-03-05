/**
 * GET /api/admin/harbor-status
 *
 * Returns cross-platform health metrics for the harbor admin dashboard.
 * Admin-only — no scoped visibility, shows the full picture.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { getHarborStatus } from "@/lib/queries/harbor-status";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const status = await getHarborStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[harbor-status] query failed:", err);
    return NextResponse.json(
      { error: "harbor status query failed" },
      { status: 500 },
    );
  }
}
