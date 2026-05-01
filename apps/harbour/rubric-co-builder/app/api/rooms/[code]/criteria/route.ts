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
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const good = typeof o.good_description === "string" ? o.good_description.trim() : "";
  const versionOf = typeof o.version_of === "string" ? o.version_of : null;

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "criterion needs a short name" }, { status: 400 });
  }

  const store = getStore();
  const snapshot = await store.getSnapshot(normalised);
  if (!snapshot) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  const criterion = await store.createCriterion({
    room_id: snapshot.room.id,
    name,
    good_description: good || null,
    source: "proposed",
    required: false,
    position: snapshot.criteria.length,
    status: "proposed",
    version_of: versionOf,
  });
  return NextResponse.json(criterion, { status: 201 });
}
