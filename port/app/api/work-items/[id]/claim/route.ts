/**
 * PATCH /api/work-items/[id]/claim
 *
 * Assigns the current user as the task's owner and moves status from
 * "in queue" → "in progress". Called from the milestone detail modal's
 * "I'll take this" button.
 *
 * Safety:
 *   - Auth required (session)
 *   - Resolves the signed-in user's Notion member ID via email match
 *     against the members DB
 *   - No-op if the task already has an owner (returns current state)
 *   - Only moves status forward (in queue → in progress); leaves other
 *     statuses untouched
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkItem, updateWorkItem } from "@/lib/notion/work-items";
import { getActiveMembers } from "@/lib/notion/members";

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
    const members = await getActiveMembers();
    const me = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!me) {
      return NextResponse.json(
        { error: `no member record for ${email}` },
        { status: 403 },
      );
    }

    const task = await getWorkItem(id);
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

    const updated = await updateWorkItem(id, {
      ownerIds: [me.id],
      personIds: Array.from(new Set([...task.personIds, me.id])),
      status: nextStatus,
    });

    return NextResponse.json({
      id: updated.id,
      task: updated.task,
      status: updated.status,
      ownerIds: updated.ownerIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("claim work-item failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
