"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkItem, Project } from "@/lib/notion/types";
import { PRIORITY_COLORS, TYPE_COLORS, PRIORITY_ORDER } from "@/lib/work-constants";

interface BacklogProps {
  workItems: WorkItem[];
  projects: Project[];
}

export function Backlog({ workItems, projects }: BacklogProps) {
  const router = useRouter();
  const projectMap = new Map(projects.map((p) => [p.id, p.project]));
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Sort by priority then by creation time
  const sorted = [...workItems].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
  });

  const handlePriorityChange = useCallback(
    async (itemId: string, newPriority: string) => {
      setUpdatingId(itemId);
      try {
        await fetch(`/api/work-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: newPriority }),
        });
        router.refresh();
      } finally {
        setUpdatingId(null);
      }
    },
    [router],
  );

  const totalEstimate = sorted.reduce((sum, wi) => sum + (wi.estimateHours ?? 0), 0);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">backlog is empty</p>
        <p className="text-xs mt-1">all studio work items are complete or archived</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {sorted.length} items · {totalEstimate.toFixed(0)}h estimated
        </p>
      </div>

      <div className="rounded-md border divide-y">
        {sorted.map((item) => {
          const projectName = item.projectIds.length > 0
            ? projectMap.get(item.projectIds[0])
            : undefined;

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
                updatingId === item.id && "opacity-50",
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />

              {/* Priority selector */}
              <select
                value={item.priority}
                onChange={(e) => handlePriorityChange(item.id, e.target.value)}
                className={cn(
                  "text-[10px] font-medium rounded px-1.5 py-0.5 border cursor-pointer",
                  PRIORITY_COLORS[item.priority] ?? "",
                )}
              >
                <option value="urgent">urgent</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.task}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {projectName && (
                    <span className="text-[10px] text-muted-foreground">{projectName}</span>
                  )}
                  {item.taskType && (
                    <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[item.taskType] ?? ""}`}>
                      {item.taskType}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{item.status}</span>
                </div>
              </div>

              {item.estimateHours != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {item.estimateHours}h
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
