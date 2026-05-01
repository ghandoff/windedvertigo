import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import { roundForState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maxVotesFor(criteriaOnBallot: number): number {
  if (criteriaOnBallot <= 1) return 1;
  return Math.min(3, Math.max(1, criteriaOnBallot - 1));
}

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
  const criterionId = typeof o.criterion_id === "string" ? o.criterion_id : "";
  if (!participantId || !criterionId) {
    return NextResponse.json({ error: "missing ids" }, { status: 400 });
  }

  const store = getStore();
  const snapshot = await store.getSnapshot(normalised);
  if (!snapshot) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  // determine round from room state (client also sends it as a hint, but server is authoritative)
  const round: 1 | 2 | 3 =
    typeof o.round === "number" && [1, 2, 3].includes(o.round)
      ? (o.round as 1 | 2 | 3)
      : roundForState(snapshot.room.state);

  const ballotSize = snapshot.criteria.filter((c) => c.status !== "rejected").length;
  const maxVotes = maxVotesFor(ballotSize);
  const count = await store.countVotesForParticipant(participantId, snapshot.room.id, round);
  if (count >= maxVotes) {
    return NextResponse.json(
      {
        error: `you've used all ${maxVotes} dot${maxVotes === 1 ? "" : "s"}. remove one first.`,
      },
      { status: 409 },
    );
  }
  const vote = await store.castVote(participantId, criterionId, round);
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
  const criterionId = url.searchParams.get("criterion_id") ?? "";
  const roundParam = url.searchParams.get("round");

  if (!participantId || !criterionId) {
    return NextResponse.json({ error: "missing ids" }, { status: 400 });
  }

  const store = getStore();
  // determine round
  let round: 1 | 2 | 3 = 1;
  if (roundParam && ["1", "2", "3"].includes(roundParam)) {
    round = Number(roundParam) as 1 | 2 | 3;
  } else {
    const snapshot = await store.getSnapshot(normalised);
    if (snapshot) round = roundForState(snapshot.room.state);
  }

  await store.removeVote(participantId, criterionId, round);
  return NextResponse.json({ ok: true });
}
