import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!isValidRoomCode(code.toUpperCase())) {
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
  const pledgeResponseId =
    typeof o.pledge_response_id === "string" ? o.pledge_response_id : "";
  if (!participantId || !pledgeResponseId) {
    return NextResponse.json({ error: "missing ids" }, { status: 400 });
  }
  const vote = await getStore().castPledgeResponseVote(participantId, pledgeResponseId);
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
  if (!isValidRoomCode(code.toUpperCase())) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const url = new URL(req.url);
  const participantId = url.searchParams.get("participant_id") ?? "";
  const pledgeResponseId = url.searchParams.get("pledge_response_id") ?? "";
  if (!participantId || !pledgeResponseId) {
    return NextResponse.json({ error: "missing ids" }, { status: 400 });
  }
  await getStore().removePledgeResponseVote(participantId, pledgeResponseId);
  return NextResponse.json({ ok: true });
}
