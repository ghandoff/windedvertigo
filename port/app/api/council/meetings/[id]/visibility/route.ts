/**
 * PATCH /api/council/meetings/[id]/visibility — toggle a meeting's
 * visibility between shared (team-visible) and private (owner-only).
 *
 * Auth model: any signed-in port user can flip their OWN meetings (matched
 * by ownerEmail). Meetings without an ownerEmail (pre-migration data) can
 * be made private by anyone — first-toggler becomes owner. This is a
 * lightweight policy good for a 4-person team; tighten if the team grows.
 *
 * Body: { visibility: 'shared' | 'private' }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMeeting, updateMeetingVisibility } from "@/lib/supabase/meetings";

const VALID = new Set(["shared", "private"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const viewerEmail = session.user.email.toLowerCase();

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { visibility?: string };
  if (!body.visibility || !VALID.has(body.visibility)) {
    return NextResponse.json(
      { error: "invalid_visibility", expected: ["shared", "private"] },
      { status: 400 },
    );
  }

  const meeting = await getMeeting(id);
  if (!meeting) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Authorize: must be the owner, OR the meeting has no owner yet
  // (first-toggler claims ownership when going private).
  if (meeting.ownerEmail && meeting.ownerEmail !== viewerEmail) {
    return NextResponse.json(
      { error: "forbidden", message: `only ${meeting.ownerEmail} can change this meeting's visibility` },
      { status: 403 },
    );
  }

  const ok = await updateMeetingVisibility(
    id,
    body.visibility as "shared" | "private",
    viewerEmail,
  );
  if (!ok) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, id, visibility: body.visibility });
}
