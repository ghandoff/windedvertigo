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
  const criterionId = typeof o.criterion_id === "string" ? o.criterion_id : "";
  const level = Number(o.level);
  const descriptor = typeof o.descriptor === "string" ? o.descriptor.slice(0, 600) : "";
  if (!criterionId || ![1, 2, 3, 4].includes(level)) {
    return NextResponse.json({ error: "missing criterion_id or level" }, { status: 400 });
  }
  const result = await getStore().upsertScaleDescriptor(
    criterionId,
    level as 1 | 2 | 3 | 4,
    descriptor,
  );
  if (!result) {
    return NextResponse.json({ error: "criterion not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
