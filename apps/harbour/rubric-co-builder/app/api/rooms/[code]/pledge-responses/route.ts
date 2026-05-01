import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
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
  const slotIndex = Number(o.slot_index);
  const content = typeof o.content === "string" ? o.content.slice(0, 800) : "";
  if (!participantId || ![1, 2, 3, 4].includes(slotIndex)) {
    return NextResponse.json(
      { error: "missing participant_id or invalid slot_index" },
      { status: 400 },
    );
  }
  const result = await getStore().upsertPledgeResponse(
    code.toUpperCase(),
    participantId,
    slotIndex as 1 | 2 | 3 | 4,
    content,
  );
  if (!result) {
    return NextResponse.json({ error: "could not save response" }, { status: 400 });
  }
  return NextResponse.json(result);
}
