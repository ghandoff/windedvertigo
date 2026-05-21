import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import { quorumGuard, readForceFlag } from "@/lib/state-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// tally round 1 votes and advance to criteria_gate for facilitator review
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
  // Quorum guard: refuse to tally with zero votes unless the host
  // explicitly passes { force: true }. snapshot.votes is already loaded;
  // count round-1 entries inline rather than firing another query.
  if (!(await readForceFlag(req))) {
    const round1Count = snapshot.votes.filter((v) => v.round === 1).length;
    const violation = quorumGuard("round 1 votes", round1Count);
    if (violation) return NextResponse.json(violation, { status: 409 });
  }
  const result = await store.tallySelection(normalised, 1, "criteria_gate");
  if (!result) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
