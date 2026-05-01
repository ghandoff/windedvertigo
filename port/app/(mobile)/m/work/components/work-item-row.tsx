"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, ChevronRight, Loader2 } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/work-constants";
import { formatDate } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  "in queue": "to do",
  "in progress": "in progress",
  "internal review": "review",
  "client review": "client review",
  suspended: "paused",
  "needs documentation": "docs needed",
};

/** Next status in the workflow progression */
const STATUS_NEXT: Record<string, string> = {
  "in queue": "in progress",
  "in progress": "internal review",
  "internal review": "complete",
  "client review": "complete",
  suspended: "in progress",
  "needs documentation": "complete",
};

interface WorkItemRowProps {
  id: string;
  task: string;
  status: string;
  priority: string | null;
  taskType: string | null;
  dueDate: string | null;
  estimateHours: number | null;
}

export function WorkItemRow({ id, task, status, priority, taskType, dueDate, estimateHours }: WorkItemRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const statusLabel = STATUS_LABELS[status] ?? status;
  const nextStatus = STATUS_NEXT[status];

  function handleAdvance() {
    if (!nextStatus || isPending) return;
    startTransition(async () => {
      await fetch(`/api/work-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-border last:border-0 transition-opacity ${isPending ? "opacity-40" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{task}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
          {priority && priority !== "medium" && (
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[priority] ?? ""}`}>
              {priority}
            </Badge>
          )}
          {taskType && (
            <span className="text-[10px] text-muted-foreground">{taskType}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
          {dueDate && (
            <span className="flex items-center gap-0.5">
              <CalendarDays className="h-2.5 w-2.5" />
              {formatDate(dueDate)}
            </span>
          )}
          {estimateHours != null && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {estimateHours}h
            </span>
          )}
        </div>
      </div>
      {nextStatus ? (
        <button
          onClick={handleAdvance}
          disabled={isPending}
          className="shrink-0 mt-1 flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 active:scale-95 transition-all disabled:opacity-40"
          title={`Advance to ${STATUS_LABELS[nextStatus] ?? nextStatus}`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      )}
    </div>
  );
}
