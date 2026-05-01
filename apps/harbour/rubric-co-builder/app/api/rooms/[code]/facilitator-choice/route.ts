import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRoomCode } from "@/lib/room-code";
import { DEFAULT_DESCRIPTORS, SCALE_LEVELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// facilitator tiebreaker: set which criteria remain selected vs rejected
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
  if (!Array.isArray(o.selected_ids)) {
    return NextResponse.json({ error: "selected_ids must be an array" }, { status: 400 });
  }
  const selectedIds = (o.selected_ids as unknown[])
    .filter((id): id is string => typeof id === "string");

  const store = getStore();
  const snapshot = await store.getSnapshot(normalised);
  if (!snapshot) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  // update statuses: keep selected_ids as "selected", reject everything else
  const selectedSet = new Set(selectedIds);
  const updates = await Promise.all(
    snapshot.criteria
      .filter((c) => !c.required) // never reject required criteria
      .map((c) =>
        store.setCriterionStatus(c.id, selectedSet.has(c.id) ? "selected" : "rejected"),
      ),
  );

  // seed default scale descriptors for any newly-selected criteria that don't have them yet
  // (tallySelection only seeds scales for what it picks; facilitator-choice can add more)
  const existingScaleCriterionIds = new Set(snapshot.scales.map((s) => s.criterion_id));
  const needsSeeding = snapshot.criteria.filter(
    (c) => selectedSet.has(c.id) && !existingScaleCriterionIds.has(c.id),
  );
  await Promise.all(
    needsSeeding.flatMap((c) =>
      SCALE_LEVELS.map(({ level }) =>
        store.upsertScaleDescriptor(c.id, level, DEFAULT_DESCRIPTORS[level]),
      ),
    ),
  );

  return NextResponse.json({ updated: updates.filter(Boolean).length });
}
