import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import type { AiUseLevel } from "@/lib/types";

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
  const levelNum = Number(o.level);
  if (!participantId || ![0, 1, 2, 3, 4].includes(levelNum)) {
    return NextResponse.json({ error: "missing participant or level" }, { status: 400 });
  }
  const vote = await getStore().castAiVote(
    participantId,
    normalised,
    levelNum as AiUseLevel,
  );
  if (!vote) {
    return NextResponse.json({ error: "couldn't record vote" }, { status: 400 });
  }
  return NextResponse.json(vote, { status: 201 });
}
