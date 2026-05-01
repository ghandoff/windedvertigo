"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "@/app/components/draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, User } from "lucide-react";
import type { WorkItem, Project } from "@/lib/notion/types";
import { PRIORITY_COLORS, TYPE_COLORS } from "@/lib/work-constants";
import { formatDate } from "@/lib/format";

// Contract work uses a simplified status flow
const STATUS_COLUMNS: KanbanColumn[] = [
  { key: "in queue", label: "to do", color: "bg-blue-500" },
  { key: "in progress", label: "in progress", color: "bg-yellow-500" },
  { key: "internal review", label: "review", color: "bg-purple-500" },
  { key: "client review", label: "client review", color: "bg-cyan-500" },
  { key: "complete", label: "done", color: "bg-green-500" },
];

const ACTIVE_STATUSES = new Set(STATUS_COLUMNS.map((c) => c.key));

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type BoardItem = WorkItem & { kanbanStatus: string; projectName?: string };

function WorkItemCard({ item }: { item: BoardItem }) {
  const deadlineDays = daysUntil(item.dueDate?.start);
  const overdue = deadlineDays !== null && deadlineDays < 0;
  const urgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 3;

  return (
    <Card className={`hover:shadow-md transition-shadow ${overdue ? "border-destructive/50" : urgent ? "border-yellow-400/50" : ""}`}>
      <CardContent className="p-3 space-y-1.5">
        <p className="text-sm font-medium leading-tight">{item.task}</p>

        {item.projectName && (
          <p className="text-[10px] text-muted-foreground truncate">{item.projectName}</p>
        )}

        <div className="flex flex-wrap gap-1">
          {item.taskType && (
            <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[item.taskType] ?? ""}`}>
              {item.taskType}
            </Badge>
          )}
          {item.priority && item.priority !== "medium" && (
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority] ?? ""}`}>
              {item.priority}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {item.dueDate?.start && (
            <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : urgent ? "text-yellow-600 font-medium" : ""}`}>
              <CalendarDays className="h-3 w-3" />
              {formatDate(item.dueDate.start)}
              {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 && ` (${deadlineDays}d)`}
            </span>
          )}
          {item.estimateHours != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.estimateHours}h
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ContractBoardProps {
  workItems: WorkItem[];
  projects: Project[];
}

export function ContractBoard({ workItems, projects }: ContractBoardProps) {
  const router = useRouter();

  const projectMap = new Map(projects.map((p) => [p.id, p.project]));

  // Map work items to kanban items, enriching with project name
  const items: BoardItem[] = workItems
    .filter((wi) => ACTIVE_STATUSES.has(wi.status) || wi.status === "suspended" || wi.status === "needs documentation")
    .map((wi) => ({
      ...wi,
      // Map suspended/needs-doc items to the review column
      kanbanStatus:
        wi.status === "suspended" || wi.status === "needs documentation"
          ? "internal review"
          : wi.status,
      projectName: wi.projectIds.length > 0
        ? projectMap.get(wi.projectIds[0]) ?? undefined
        : undefined,
    }));

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      await fetch(`/api/work-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    },
    [router],
  );

  const renderCard = useCallback(
    (item: BoardItem) => <WorkItemCard item={item} />,
    [],
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">no active contract work items</p>
        <p className="text-xs mt-1">create work items in Notion or mark projects as &quot;contract&quot; type to see them here</p>
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
