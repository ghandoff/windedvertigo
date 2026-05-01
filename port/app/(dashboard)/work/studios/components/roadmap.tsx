"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { WorkItem, Project, Cycle } from "@/lib/notion/types";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  "complete": <CheckCircle2 className="h-3 w-3 text-green-500" />,
  "in progress": <Loader2 className="h-3 w-3 text-yellow-500" />,
  "internal review": <Loader2 className="h-3 w-3 text-purple-500" />,
};

interface RoadmapProps {
  workItems: WorkItem[];
  projects: Project[];
  cycles: Cycle[];
}

export function Roadmap({ workItems, projects, cycles }: RoadmapProps) {
  // Group work items by project
  const byProject = new Map<string, WorkItem[]>();

  for (const wi of workItems) {
    for (const pid of wi.projectIds) {
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid)!.push(wi);
    }
  }

  // Only show projects that have work items
  const activeProjects = projects.filter((p) => byProject.has(p.id));

  if (activeProjects.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">no studio projects with work items</p>
        <p className="text-xs mt-1">create work items and assign them to studio projects</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeProjects.map((project) => {
        const items = byProject.get(project.id) ?? [];
        const completed = items.filter((i) => i.status === "complete" || i.status === "cancelled");
        const inProgress = items.filter((i) => i.status === "in progress" || i.status === "internal review");
        const todo = items.filter((i) => !["complete", "cancelled", "in progress", "internal review", "icebox"].includes(i.status));
        const totalEstimate = items.reduce((sum, i) => sum + (i.estimateHours ?? 0), 0);
        const completedEstimate = completed.reduce((sum, i) => sum + (i.estimateHours ?? 0), 0);
        const progressPct = totalEstimate > 0 ? (completedEstimate / totalEstimate) * 100 : 0;

        // Find cycles linked to this project
        const projectCycles = cycles.filter((c) => c.projectIds.includes(project.id));

        return (
          <Card key={project.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{project.project}</CardTitle>
                <div className="flex items-center gap-2">
                  {projectCycles.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {projectCycles[0].cycle}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {project.status}
                  </Badge>
                </div>
              </div>

              {/* Progress bar */}
              {totalEstimate > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{completedEstimate.toFixed(0)}h / {totalEstimate.toFixed(0)}h</span>
                    <span>{progressPct.toFixed(0)}% complete</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(progressPct, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-1">
              {/* In progress items */}
              {inProgress.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1.5">
                  {STATUS_ICONS[item.status] ?? <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-sm flex-1 truncate">{item.task}</span>
                  {item.estimateHours != null && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {item.estimateHours}h
                    </span>
                  )}
                </div>
              ))}

              {/* To do items */}
              {todo.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1.5">
                  <Circle className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-sm text-muted-foreground flex-1 truncate">{item.task}</span>
                  {item.estimateHours != null && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {item.estimateHours}h
                    </span>
                  )}
                </div>
              ))}

              {/* Completed summary */}
              {completed.length > 0 && (
                <div className="flex items-center gap-2 py-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-500/60" />
                  <span className="text-xs">{completed.length} completed</span>
                </div>
              )}

              {items.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">no work items</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
