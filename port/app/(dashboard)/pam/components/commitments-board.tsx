"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "@/app/components/draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Link2, AlertTriangle } from "lucide-react";
import type { PamCommitment } from "@/lib/supabase/pam";
import { formatDate } from "@/lib/format";
import { updateCommitmentStatusAction } from "../actions";

// Columns map 1:1 to the pam_commitments status enum.
const STATUS_COLUMNS: KanbanColumn[] = [
  { key: "not-started", label: "not started", color: "bg-slate-400" },
  { key: "in-progress", label: "in progress", color: "bg-yellow-500" },
  { key: "blocked", label: "blocked", color: "bg-red-500" },
  { key: "done", label: "done", color: "bg-green-500" },
  { key: "parked", label: "parked", color: "bg-slate-300" },
];

type BoardItem = PamCommitment & { kanbanStatus: string };

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();
  return Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24));
}

function CommitmentCard({ item }: { item: BoardItem }) {
  const active = item.status !== "done" && item.status !== "parked";
  const dleft = daysUntil(item.due_date);
  const overdue = active && dleft !== null && dleft < 0;
  const urgent = active && dleft !== null && dleft >= 0 && dleft <= 3;
  const depCount = item.depends_on?.length ?? 0;

  return (
    <Card
      className={`hover:shadow-md transition-shadow ${
        overdue ? "border-destructive/50" : urgent ? "border-yellow-400/50" : ""
      }`}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] capitalize">{item.who}</Badge>
          {item.source && (
            <span className="text-[10px] text-muted-foreground">via {item.source}</span>
          )}
        </div>

        <p className="text-sm font-medium leading-tight">{item.what}</p>

        {item.status === "blocked" && item.blocker && (
          <p className="text-[11px] text-destructive flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{item.blocker}</span>
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {item.due_date && (
            <span
              className={`flex items-center gap-1 ${
                overdue ? "text-destructive font-medium" : urgent ? "text-yellow-600 font-medium" : ""
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDate(item.due_date)}
              {overdue ? " · overdue" : urgent && dleft !== null ? ` · ${dleft}d` : ""}
            </span>
          )}
          {depCount > 0 && (
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {depCount} dep{depCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CommitmentsBoard({ commitments }: { commitments: PamCommitment[] }) {
  const router = useRouter();

  const items: BoardItem[] = commitments.map((c) => ({ ...c, kanbanStatus: c.status }));

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      const res = await updateCommitmentStatusAction(itemId, newStatus);
      if (res.error) throw new Error(res.error);
      router.refresh();
    },
    [router],
  );

  const renderCard = useCallback((item: BoardItem) => <CommitmentCard item={item} />, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">no commitments yet</p>
        <p className="text-xs mt-1">
          add one above, or PaM logs them automatically from cowork sessions and whirlpools
        </p>
      </div>
    );
  }

  return (
    <DraggableKanban
      columns={STATUS_COLUMNS}
      items={items}
      renderCard={renderCard}
      onStatusChange={handleStatusChange}
    />
  );
}
