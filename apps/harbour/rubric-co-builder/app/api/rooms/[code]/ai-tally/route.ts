import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/rooms/[code]/ai-tally
// reads the current room state:
//  - ai_ladder_propose → advance to ai_ladder (open the proposal-vote ballot)
//  - ai_ladder         → tally proposal votes, lock the ceiling, advance to vote3
//  - vote3             → tally direct AI use votes, advance to pledge
// falls back to the legacy level-ladder tally if no proposals have been posted.
export async function POST(
  _req: Request,
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

  if (snapshot.room.state === "ai_ladder_propose") {
    await store.updateRoomState(normalised, "ai_ladder");
    return NextResponse.json({ advanced_to: "ai_ladder" });
  }

  if (snapshot.room.state === "vote3") {
    const result = await store.tallyAiVote(normalised);
    if (!result) {
      return NextResponse.json({ error: "couldn't tally" }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  // ai_ladder: tally proposals, advance to vote3 for final direct vote
  const hasProposals = (snapshot.ai_use_proposals?.length ?? 0) > 0;
  const result = hasProposals
    ? await store.tallyAiProposals(normalised)
    : await store.tallyAiLadder(normalised);
  if (!result) {
    return NextResponse.json({ error: "couldn't tally" }, { status: 400 });
  }
  await store.updateRoomState(normalised, "vote3");
  return NextResponse.json(result);
}
