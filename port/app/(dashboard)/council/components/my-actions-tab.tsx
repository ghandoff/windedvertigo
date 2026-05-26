/**
 * my-actions-tab.tsx — current user's open action items across all meetings.
 *
 * Server component reads listOpenActionsForOwner. Status toggle (mark done)
 * deferred to a client island that POSTs to /api/council/actions/[id] — not
 * built in this slice. For now this is read-only with a status badge.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertCircle, ArrowRight } from "lucide-react";
import type { MeetingActionItem } from "@/lib/supabase/meeting-action-items";
import { ActionStatusToggle } from "./action-status-toggle";
import { PromoteActionButton } from "./promote-action-button";

export interface MyActionsTabProps {
  userEmail: string | null;
  actions: MeetingActionItem[];
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "no deadline";
  const d = new Date(deadline);
  const today = new Date();
  const daysOut = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (daysOut < 0) return `overdue by ${-daysOut}d`;
  if (daysOut === 0) return "today";
  if (daysOut === 1) return "tomorrow";
  if (daysOut <= 7) return `in ${daysOut}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function priorityClass(p: MeetingActionItem["priority"]): string {
  if (p === "high") return "text-[#b15043] border-[#b15043]/30 bg-[#b15043]/5";
  if (p === "medium") return "text-[#cb7858] border-[#cb7858]/30 bg-[#cb7858]/5";
  return "text-muted-foreground border-muted/30 bg-muted/5";
}

export function MyActionsTab({ userEmail, actions }: MyActionsTabProps) {
  if (!userEmail) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          sign in to see your open actions.
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          no open actions for <span className="text-[#273248]">{userEmail}</span>.
          either you&apos;re clear, or no meetings have been ingested with you
          as an owner yet.
        </CardContent>
      </Card>
    );
  }

  // Group by overdue / soon / later for visual hierarchy
  const overdue = actions.filter((a) => {
    if (!a.deadline) return false;
    return new Date(a.deadline) < new Date();
  });
  const dueSoon = actions.filter((a) => {
    if (!a.deadline) return false;
    const days = (new Date(a.deadline).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 7;
  });
  const later = actions.filter((a) => !overdue.includes(a) && !dueSoon.includes(a));

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <Card className="border-[#b15043]/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#b15043] inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              overdue ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {overdue.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </CardContent>
        </Card>
      )}

      {dueSoon.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              this week ({dueSoon.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {dueSoon.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </CardContent>
        </Card>
      )}

      {later.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              later ({later.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {later.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground pt-2">
        mark-done UI lands when the council actions API ships. for now manage
        status via the supabase studio or wv-claw.
      </p>
    </div>
  );
}

function ActionRow({ action }: { action: MeetingActionItem }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#273248]">{action.title}</p>
        {action.context && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
            {action.context}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {action.priority && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(action.priority)}`}>
              {action.priority}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums">
            due: {formatDeadline(action.deadline)}
          </span>
          <ActionStatusToggle
            actionId={action.id}
            initialStatus={action.status}
            compact
          />
          <PromoteActionButton
            actionId={action.id}
            initialWorkItemId={action.workItemId}
            compact
          />
        </div>
      </div>
      <Link
        href={`/council/${action.meetingId}`}
        className="text-muted-foreground hover:text-[#b15043] shrink-0 mt-1"
        title="view meeting"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
