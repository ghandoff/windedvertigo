import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import { staleStateGuard } from "@/lib/state-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const o = (body ?? {}) as Record<string, unknown>;
  const participantId = typeof o.participant_id === "string" ? o.participant_id : "";
  const scaleResponseId =
    typeof o.scale_response_id === "string" ? o.scale_response_id : "";
  if (!participantId || !scaleResponseId) {
    return NextResponse.json({ error: "missing ids" }, { status: 400 });
  }
  if (!(await getStore().participantExists(participantId, normalised))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Uses lightweight getRoomState (single SELECT) instead of getSnapshot.
  const currentState = await getStore().getRoomState(normalised);
  if (!currentState) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  const stale = staleStateGuard(currentState, ["vote2"]);
  if (stale) return NextResponse.json(stale, { status: 409 });
  const vote = await getStore().castScaleResponseVote(participantId, scaleResponseId);
  if (!vote) {
    return NextResponse.json({ error: "couldn't cast vote" }, { status: 400 });
  }
  return NextResponse.json(vote, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalised = code.toUpperCase();
  if (!isValidRoomCode(normalised)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const url = new URL(req.url);
  const participantId = url.searchParams.get("participant_id") ?? "";
  const scaleResponseId = url.searchParams.get("scale_response_id") ?? "";
  if (!participantId || !scaleResponseId) {
    return NextResponse.json({ error: "missing ids" }, { status: 400 });
  }
  if (!(await getStore().participantExists(participantId, normalised))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await getStore().removeScaleResponseVote(participantId, scaleResponseId);
  return NextResponse.json({ ok: true });
}
