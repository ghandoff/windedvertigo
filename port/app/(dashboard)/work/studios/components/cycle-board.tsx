"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "@/app/components/draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, Pencil, Plus, Target } from "lucide-react";
import { CycleDialog } from "./cycle-dialog";
import type { WorkItem, Project, Cycle } from "@/lib/notion/types";
import { TYPE_COLORS } from "@/lib/work-constants";
import { formatDate } from "@/lib/format";

// Studio work flow — simpler than contracts
const STATUS_COLUMNS: KanbanColumn[] = [
  { key: "in queue", label: "to do", color: "bg-blue-500" },
  { key: "in progress", label: "in progress", color: "bg-yellow-500" },
  { key: "internal review", label: "in review", color: "bg-purple-500" },
  { key: "complete", label: "shipped", color: "bg-green-500" },
];

const ACTIVE_STATUSES = new Set(STATUS_COLUMNS.map((c) => c.key));

type BoardItem = WorkItem & { kanbanStatus: string; projectName?: string };

function WorkItemCard({ item }: { item: BoardItem }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
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
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

interface CycleBoardProps {
  cycle: Cycle | null;
  cycles: Cycle[];
  workItems: WorkItem[];
  projects: Project[];
}

export function CycleBoard({ cycle, cycles, workItems, projects }: CycleBoardProps) {
  const router = useRouter();
  const projectMap = new Map(projects.map((p) => [p.id, p.project]));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);

  const items: BoardItem[] = workItems
    .filter((wi) => ACTIVE_STATUSES.has(wi.status) || wi.status === "needs documentation")
    .map((wi) => ({
      ...wi,
      kanbanStatus: wi.status === "needs documentation" ? "internal review" : wi.status,
      projectName: wi.projectIds.length > 0 ? projectMap.get(wi.projectIds[0]) ?? undefined : undefined,
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

  if (!cycle) {
    return (
      <>
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">no cycles yet</p>
          <p className="text-xs mt-1 mb-4">create a cycle to start planning studio sprints</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditingCycle(null); setDialogOpen(true); }}
          >
            <Plus className="h-3 w-3 mr-1" />
            new cycle
          </Button>
        </div>
        <CycleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          cycle={editingCycle}
          projects={projects}
        />
      </>
    );
  }

  return (
    <>
      {/* Cycle header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{cycle.cycle}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <Badge variant="outline" className="text-[10px]">{cycle.status}</Badge>
            {cycle.startDate?.start && cycle.endDate?.start && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {formatDate(cycle.startDate.start)} — {formatDate(cycle.endDate.start)}
              </span>
            )}
            <span>{items.length} items</span>
          </div>
          {cycle.goal && (
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">{cycle.goal}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => { setEditingCycle(cycle); setDialogOpen(true); }}
          >
            <Pencil className="h-3 w-3 mr-1" />
            edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => { setEditingCycle(null); setDialogOpen(true); }}
          >
            <Plus className="h-3 w-3 mr-1" />
            new cycle
          </Button>
          {cycles.length > 1 && (
            <select
              value={cycle.id}
              onChange={(e) => {
                router.push(`/work/studios?view=cycle&cycleId=${e.target.value}`);
              }}
              className="text-xs border rounded px-2 py-1 bg-background"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cycle} ({c.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">no work items in this cycle</p>
          <p className="text-xs mt-1">assign work items to studio projects linked to this cycle</p>
        </div>
      ) : (
        <DraggableKanban
          columns={STATUS_COLUMNS}
          items={items}
          renderCard={renderCard}
          onStatusChange={handleStatusChange}
        />
      )}

      <CycleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cycle={editingCycle}
        projects={projects}
      />
    </>
  );
}
