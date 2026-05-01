import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DURATIONS = [180, 300, 600] as const;

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

  const { duration } = (body ?? {}) as { duration?: number | null };

  if (duration !== null && duration !== undefined) {
    if (!ALLOWED_DURATIONS.includes(duration as (typeof ALLOWED_DURATIONS)[number])) {
      return NextResponse.json({ error: "duration must be 180, 300, or 600" }, { status: 400 });
    }
  }

  const updated = await getStore().setTimer(normalised, duration ?? null);
  if (!updated) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  return NextResponse.json({ timer_end: updated.timer_end, timer_duration: updated.timer_duration });
}
