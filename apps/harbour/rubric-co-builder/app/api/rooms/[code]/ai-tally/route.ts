import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import { quorumGuard, readForceFlag } from "@/lib/state-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/rooms/[code]/ai-tally
// reads the current room state:
//  - ai_ladder_propose → advance to ai_ladder (open the proposal-vote ballot)
//  - ai_ladder         → tally proposal votes, lock the ceiling, advance to vote3
//  - vote3             → tally direct AI use votes, advance to pledge
// falls back to the legacy level-ladder tally if no proposals have been posted.
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

  // Quorum guard varies by state — ai-tally has three modes (Maria #2).
  // Default required = 1 for all, override via { force: true } in body.
  const force = await readForceFlag(req);

  if (snapshot.room.state === "ai_ladder_propose") {
    // Opening the proposal-vote ballot. Need ≥1 proposal to vote on,
    // otherwise the next screen is empty.
    if (!force) {
      const violation = quorumGuard(
        "AI use proposals",
        snapshot.ai_use_proposals.length,
      );
      if (violation) return NextResponse.json(violation, { status: 409 });
    }
    await store.updateRoomState(normalised, "ai_ladder");
    return NextResponse.json({ advanced_to: "ai_ladder" });
  }

  if (snapshot.room.state === "vote3") {
    // Final binding AI-use vote tally → advance to pledge.
    if (!force) {
      const violation = quorumGuard(
        "AI-use votes",
        snapshot.ai_use_votes.length,
      );
      if (violation) return NextResponse.json(violation, { status: 409 });
    }
    const result = await store.tallyAiVote(normalised);
    if (!result) {
      return NextResponse.json({ error: "couldn't tally" }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  // ai_ladder: tally proposal votes (or fall back to legacy ai_use_votes
  // if no proposals were posted). Quorum is "any input exists" — either
  // proposal votes OR fallback votes — since the store function picks
  // the right path based on hasProposals below.
  const hasProposals = (snapshot.ai_use_proposals?.length ?? 0) > 0;
  if (!force) {
    const inputCount = hasProposals
      ? snapshot.ai_use_proposal_votes.length
      : snapshot.ai_use_votes.length;
    const violation = quorumGuard(
      hasProposals ? "votes on AI-use proposals" : "AI-use votes",
      inputCount,
    );
    if (violation) return NextResponse.json(violation, { status: 409 });
  }
  const result = hasProposals
    ? await store.tallyAiProposals(normalised)
    : await store.tallyAiLadder(normalised);
  if (!result) {
    return NextResponse.json({ error: "couldn't tally" }, { status: 400 });
  }
  await store.updateRoomState(normalised, "vote3");
  return NextResponse.json(result);
}
