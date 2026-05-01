import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await params;
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
  const patch: {
    name?: string;
    good_description?: string | null;
    failure_description?: string | null;
  } = {};
  if (typeof o.name === "string") patch.name = o.name.trim().slice(0, 120);
  if (typeof o.good_description === "string") {
    patch.good_description = o.good_description.trim().slice(0, 500);
  }
  if (typeof o.failure_description === "string") {
    patch.failure_description = o.failure_description.trim().slice(0, 500);
  }

  const updated = await getStore().updateCriterion(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "criterion not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await params;
  if (!isValidRoomCode(code.toUpperCase())) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const ok = await getStore().deleteCriterion(id);
  if (!ok) {
    return NextResponse.json({ error: "criterion not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
