/**
 * Admin API: manual Notion sync trigger.
 *
 * POST /api/admin/sync â run the Notion sync immediately.
 *
 * MVP 4 â admin pages and rate limiting.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAccess } from "@/lib/queries/audit";
import { syncAll } from "@/lib/sync";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();

  try {
    await syncAll();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(session.userId, null, null, null, "admin_manual_sync", ip, []);

    return NextResponse.json(
      { success: true, message: "sync completed" },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "sync failed" },
      { status: 500 },
    );
  }
}
