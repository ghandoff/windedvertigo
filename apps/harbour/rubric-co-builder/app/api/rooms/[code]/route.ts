import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import type { RoomState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATES: RoomState[] = [
  "lobby",
  "frame",
  "propose",
  "vote",
  "criteria_gate",
  "scale",
  "vote2",
  "vote3",
  "calibrate",
  "ai_ladder_propose",
  "ai_ladder",
  "pledge",
  "pledge_vote",
  "commit",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalised = code.toUpperCase();
  if (!isValidRoomCode(normalised)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  const snapshot = await getStore().getSnapshot(normalised);
  if (!snapshot) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}

export async function PATCH(
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

  const { state, from_state } = (body ?? {}) as { state?: string; from_state?: string };
  if (!state || !VALID_STATES.includes(state as RoomState)) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  // if from_state is provided, only advance if the room is still in that state
  // (prevents timer-expiry races where multiple clients call advance simultaneously)
  // snapshot errors (e.g. transient db issue) fall through so the update still runs
  if (from_state) {
    try {
      const snapshot = await getStore().getSnapshot(normalised);
      if (!snapshot) {
        return NextResponse.json({ error: "room not found" }, { status: 404 });
      }
      if (snapshot.room.state !== from_state) {
        return NextResponse.json({ code: snapshot.room.code, state: snapshot.room.state });
      }
    } catch {
      // snapshot fetch failed — skip race-guard and attempt the update
    }
  }

  const updated = await getStore().updateRoomState(normalised, state as RoomState);
  if (!updated) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  return NextResponse.json({ code: updated.code, state: updated.state });
}
