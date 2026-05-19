import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Participant heartbeat — bumps `last_seen_at` for the calling participant.
 *
 * Called from the student client every HEARTBEAT_INTERVAL_MS (4 min).
 * Cheap by design: one UPDATE, no auth beyond participant id existence.
 *
 * Returns 200 on success, 404 if the participant no longer exists in this
 * room (e.g., room was reset or participant was pruned). The client uses
 * that signal to clear its cached participant_id and re-join.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalised = code.toUpperCase();
  if (!isValidRoomCode(normalised)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const participantId =
    typeof (body as { participant_id?: unknown })?.participant_id === "string"
      ? ((body as { participant_id: string }).participant_id)
      : "";
  if (!participantId) {
    return NextResponse.json({ error: "missing participant_id" }, { status: 400 });
  }
  const ok = await getStore().touchParticipant(participantId, normalised);
  if (!ok) {
    return NextResponse.json({ error: "participant not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
