import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import type { PledgeSlotIndex } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
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
  const slotIndex = Number(o.slot_index);
  const content = typeof o.content === "string" ? o.content.slice(0, 800) : "";
  if (![1, 2, 3, 4].includes(slotIndex)) {
    return NextResponse.json({ error: "missing slot_index" }, { status: 400 });
  }
  const slot = await getStore().upsertPledgeSlot(
    normalised,
    slotIndex as PledgeSlotIndex,
    content,
  );
  if (!slot) {
    return NextResponse.json({ error: "couldn't save slot" }, { status: 400 });
  }
  return NextResponse.json(slot);
}
