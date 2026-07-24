/**
 * POST /api/vinay/grade — record garrett's grade on a brief (or one item),
 * from the /vinay page's grade buttons. Session-gated to garrett only
 * (isVinayOwner) — this is the browser-session path, distinct from the MCP
 * connector's token/OAuth gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isVinayOwner } from "@/lib/oauth/config";
import { gradeVinayBrief, type VinayGrade } from "@/lib/vinay/grades";

const VALID: VinayGrade[] = ["useful", "not-useful", "wrong"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!isVinayOwner(session?.user?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { brief_id?: string; grade?: string; item_key?: string | null; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.brief_id || !body.grade) {
    return NextResponse.json({ error: "brief_id and grade are required" }, { status: 400 });
  }
  if (!VALID.includes(body.grade as VinayGrade)) {
    return NextResponse.json({ error: "invalid grade" }, { status: 400 });
  }

  await gradeVinayBrief({
    brief_id: body.brief_id,
    grade: body.grade as VinayGrade,
    item_key: body.item_key || null,
    note: body.note || null,
  });
  return NextResponse.json({ ok: true });
}
