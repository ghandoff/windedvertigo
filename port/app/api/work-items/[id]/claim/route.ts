/**
 * PATCH /api/work-items/[id]/claim
 *
 * Assigns the current user as the task's owner and moves status from
 * "in queue" → "in progress". Called from the milestone detail modal's
 * "I'll take this" button.
 *
 * Phase A3: reads/writes use Supabase directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkItemByIdFromSupabase,
  upsertWorkItemToSupabase,
} from "@/lib/supabase/work-items";
import { getActiveMembersFromSupabase } from "@/lib/supabase/members";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const members = await getActiveMembersFromSupabase();
    const me = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!me) {
      return NextResponse.json(
        { error: `no member record for ${email}` },
        { status: 403 },
      );
    }

    const task = await getWorkItemByIdFromSupabase(id);
    if (!task) {
      return NextResponse.json({ error: "work item not found" }, { status: 404 });
    }

    if (task.ownerIds.length > 0 && !task.ownerIds.includes(me.id)) {
      return NextResponse.json(
        {
          error: "already claimed",
          ownerIds: task.ownerIds,
        },
        { status: 409 },
      );
    }

    const nextStatus =
      task.status === "in queue" || task.status === "icebox"
        ? "in progress"
        : task.status;

    await upsertWorkItemToSupabase(id, {
      owner_ids: [me.id],
      person_ids: Array.from(new Set([...task.personIds, me.id])),
      status: nextStatus,
    });

    return NextResponse.json({
      id,
      task: task.task,
      status: nextStatus,
      ownerIds: [me.id],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("claim work-item failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
