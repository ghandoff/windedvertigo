import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// tally round 2: pick the most-voted scale_response per (criterion, level),
// write it into canonical scales, and advance to ai_ladder_propose.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalised = code.toUpperCase();
  if (!isValidRoomCode(normalised)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const store = getStore();
  const snapshot = await store.getSnapshot(normalised);
  if (!snapshot) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  const hostToken = req.headers.get("X-Host-Token") ?? "";
  if (!hostToken || snapshot.room.host_token !== hostToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await store.tallyScaleResponseVotes(
    normalised,
    "ai_ladder_propose",
  );
  if (!result) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
