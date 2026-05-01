/**
 * API route: /api/runs/[id]/co-play-reflections
 *
 * POST – Submit reflections as the co-play partner
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { addCoPlayReflections } from "@/lib/queries/co-play";
import { logAccess } from "@/lib/queries/audit";
import { awardCredit, CREDIT_VALUES } from "@/lib/queries/credits";
import { MAX_LENGTHS, checkLength, parseJsonBody } from "@/lib/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id } = await params;

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { notes, rating, highlights } = body as Record<string, unknown>;

  // Validate fields
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be a number between 1 and 5" },
      { status: 400 },
    );
  }

  if (typeof notes !== "string") {
    return NextResponse.json(
      { error: "notes must be a string" },
      { status: 400 },
    );
  }

  // Length validation
  const lengthErr = checkLength("notes", notes, MAX_LENGTHS.freeText);
  if (lengthErr) {
    return NextResponse.json({ error: lengthErr }, { status: 400 });
  }

  // Validate highlights array
  if (!Array.isArray(highlights)) {
    return NextResponse.json(
      { error: "highlights must be an array" },
      { status: 400 },
    );
  }

  if (
    highlights.some(
      (h) => typeof h !== "string" || h.length === 0 || h.length > 100,
    )
  ) {
    return NextResponse.json(
      { error: "each highlight must be a non-empty string under 100 chars" },
      { status: 400 },
    );
  }

  if (highlights.length > 10) {
    return NextResponse.json(
      { error: "maximum 10 highlights allowed" },
      { status: 400 },
    );
  }

  // Submit reflections
  const success = await addCoPlayReflections(id, session.userId, {
    notes: notes.trim(),
    rating,
    highlights: highlights.map((h: string) => h.trim()),
  });

  if (!success) {
    return NextResponse.json(
      { error: "run not found or not authorised to submit reflections" },
      { status: 404 },
    );
  }

  // Award credit for full reflection (fire-and-forget)
  awardCredit(
    session.userId,
    session.orgId,
    CREDIT_VALUES.full_reflection,
    "full_reflection",
    id,
  ).catch(() => {});

  // Audit log
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    "submit_co_play_reflections",
    ip,
    ["notes", "rating", "highlights"],
  );

  return NextResponse.json(
    { message: "reflections submitted" },
    { status: 201 },
  );
}
