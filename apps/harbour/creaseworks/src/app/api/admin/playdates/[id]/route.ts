/**
 * API route: /api/admin/playdates/[id]
 *
 * GET — fetch full playdate detail for admin content preview.
 *       Returns all content fields (find/fold/unfold HTML, body,
 *       materials list, collective-tier metadata).
 *
 * Admin-only — lazy-loaded by the admin playdate browser
 * when an admin expands a card for content review.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAdminPlaydateDetail } from "@/lib/queries/playdates";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const detail = await getAdminPlaydateDetail(id);
    if (!detail) {
      return NextResponse.json(
        { error: "playdate not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error("admin playdate detail error:", error);
    return NextResponse.json(
      { error: "failed to fetch playdate detail" },
      { status: 500 },
    );
  }
}
