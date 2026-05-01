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
  const criterionId = typeof o.criterion_id === "string" ? o.criterion_id : "";
  const level = Number(o.level);
  if (!participantId || !criterionId || ![1, 2, 3, 4].includes(level)) {
    return NextResponse.json({ error: "missing ids or level" }, { status: 400 });
  }
  const score = await getStore().submitCalibrationScore(
    participantId,
    criterionId,
    level as 1 | 2 | 3 | 4,
  );
  if (!score) {
    return NextResponse.json({ error: "couldn't record score" }, { status: 400 });
  }
  return NextResponse.json(score, { status: 201 });
}
