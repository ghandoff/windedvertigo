import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import { quorumGuard, readForceFlag } from "@/lib/state-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// tally AI use votes and advance to pledge
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
  // Quorum guard: require ≥1 final AI-use vote unless { force: true }.
  if (!(await readForceFlag(req))) {
    const violation = quorumGuard("AI-use votes", snapshot.ai_use_votes.length);
    if (violation) return NextResponse.json(violation, { status: 409 });
  }
  const result = await store.tallyAiVote(normalised);
  if (!result) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
