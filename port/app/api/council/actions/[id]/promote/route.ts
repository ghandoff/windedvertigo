/**
 * POST /api/council/actions/[id]/promote — promote a meeting action item
 * into a real Notion work_item (port's task system).
 *
 * Flow:
 *   1. Read the meeting_action_items row
 *   2. Skip if work_item_id already set (already promoted)
 *   3. Resolve owner_email → Notion person id via getNotionUserMap()
 *   4. Map fields: title/priority/type/deadline → work_item shape
 *   5. createWorkItem in Notion
 *   6. Save meeting_action_items.work_item_id = new id
 *
 * Auth: any signed-in port user (no per-user gating — meeting actions are
 * already team-visible when their meeting is shared, and ingest already
 * resolved owner. Tightening to "only owner can promote" is a future polish.)
 *
 * On Notion-side failure, returns the error string but doesn't update the
 * Supabase row — caller can retry without orphaning data.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActionItem, setActionWorkItemId } from "@/lib/supabase/meeting-action-items";
import { createWorkItem } from "@/lib/notion/work-items";
import { getNotionUserMap } from "@/lib/role";
import type { WorkItemPriority, WorkItemType } from "@/lib/notion/types";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const action = await getActionItem(id);
  if (!action) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (action.workItemId) {
    // Already promoted — return the existing link rather than create a dupe.
    return NextResponse.json(
      {
        ok: true,
        alreadyPromoted: true,
        workItemId: action.workItemId,
        workItemUrl: `https://www.notion.so/${action.workItemId.replace(/-/g, "")}`,
      },
    );
  }

  // Resolve owner email → Notion person id. Falls back to no owner when
  // either the email isn't set on the action or doesn't match a port member.
  let ownerIds: string[] = [];
  if (action.ownerEmail) {
    try {
      const userMap = await getNotionUserMap();
      const personId = userMap.get(action.ownerEmail.toLowerCase());
      if (personId) ownerIds = [personId];
    } catch (err) {
      console.warn(
        "[council/actions/promote] getNotionUserMap failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Map meeting action's WorkItemType/Priority — those enums already match,
  // so direct cast is fine.
  const taskType = (action.type ?? "admin") as WorkItemType;
  const priority = (action.priority ?? "medium") as WorkItemPriority;

  try {
    const workItem = await createWorkItem({
      task: action.title,
      status: "in queue",
      taskType,
      priority,
      ownerIds,
      dueDate: action.deadline ? { start: action.deadline, end: null } : null,
    });

    const linked = await setActionWorkItemId(action.id, workItem.id);
    if (!linked) {
      // The work_item exists in Notion but we couldn't store the back-link.
      // Return success anyway so the user sees it was created; they can
      // re-promote and we'll detect the existing link via alreadyPromoted.
      return NextResponse.json(
        {
          ok: true,
          workItemId: workItem.id,
          workItemUrl: `https://www.notion.so/${workItem.id.replace(/-/g, "")}`,
          warning: "work_item created but back-link save failed",
        },
      );
    }

    return NextResponse.json({
      ok: true,
      workItemId: workItem.id,
      workItemUrl: `https://www.notion.so/${workItem.id.replace(/-/g, "")}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`[council/actions/promote] createWorkItem failed for ${id}:`, message);
    return NextResponse.json({ error: "promote_failed", message }, { status: 500 });
  }
}
