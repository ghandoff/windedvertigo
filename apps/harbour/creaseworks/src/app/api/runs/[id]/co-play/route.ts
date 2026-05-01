/**
 * API route: /api/runs/[id]/co-play
 *
 * GET  – Get co-play details for a run
 * POST – Enable co-play mode on a run (owner only)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { enableCoPlay, getCoPlayDetails } from "@/lib/queries/co-play";
import { logAccess } from "@/lib/queries/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id } = await params;

  const details = await getCoPlayDetails(id, session.userId);

  if (!details) {
    return NextResponse.json(
      { error: "run not found or not authorised" },
      { status: 404 },
    );
  }

  return NextResponse.json({ coPlay: details });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id } = await params;

  // Enable co-play (generates and stores invite code)
  const inviteCode = await enableCoPlay(id, session.userId);

  if (!inviteCode) {
    return NextResponse.json(
      { error: "run not found or not authorised to enable co-play" },
      { status: 404 },
    );
  }

  // Audit log
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    "enable_co_play",
    ip,
    ["co_play_invite_code"],
  );

  return NextResponse.json(
    { inviteCode, message: "co-play enabled" },
    { status: 201 },
  );
}
