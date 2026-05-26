/**
 * PATCH /api/council/actions/[id] — update an action item's status.
 *
 * Body: { status: 'open' | 'done' | 'cancelled' }
 *
 * Auth: requires logged-in port session. Doesn't check ownership — any
 * team member can mark any team member's actions (small team, high trust;
 * tighten later if needed).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateActionStatus, type ActionStatus } from "@/lib/supabase/meeting-action-items";

const VALID_STATUSES: ReadonlySet<ActionStatus> = new Set(["open", "done", "cancelled"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = body.status;

  if (!status || !VALID_STATUSES.has(status as ActionStatus)) {
    return NextResponse.json(
      { error: "invalid_status", expected: ["open", "done", "cancelled"] },
      { status: 400 },
    );
  }

  const ok = await updateActionStatus(id, status as ActionStatus);
  if (!ok) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, status });
}
