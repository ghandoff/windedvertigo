/**
 * API route: /api/co-play/join
 *
 * POST – Join a co-play session using an invite code
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { joinCoPlay } from "@/lib/queries/co-play";
import { logAccess } from "@/lib/queries/audit";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { inviteCode } = body as Record<string, unknown>;

  // Validate
  if (!inviteCode || typeof inviteCode !== "string" || !inviteCode.trim()) {
    return NextResponse.json(
      { error: "inviteCode is required" },
      { status: 400 },
    );
  }

  // Attempt to join
  const success = await joinCoPlay(inviteCode.trim().toUpperCase(), session.userId);

  if (!success) {
    return NextResponse.json(
      { error: "invite code not found or invalid" },
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
    "join_co_play",
    ip,
    [],
  );

  return NextResponse.json({ message: "joined co-play session" }, { status: 200 });
}
