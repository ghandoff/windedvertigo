"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/notion/types";

interface BudgetViewProps {
  projects: Project[];
  projectBurnMap: Map<string, number>;
}

function BurnBar({ burned, budget }: { burned: number; budget: number }) {
  const pct = budget > 0 ? Math.min((burned / budget) * 100, 100) : 0;
  const overBudget = burned > budget;
  const warning = pct >= 75 && pct < 90;
  const danger = pct >= 90;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="tabular-nums">
          {burned.toFixed(1)}h / {budget}h
        </span>
        <span className={cn(
          "font-medium tabular-nums",
          overBudget ? "text-destructive" : danger ? "text-destructive" : warning ? "text-yellow-600" : "text-muted-foreground",
        )}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            overBudget ? "bg-destructive" : danger ? "bg-destructive" : warning ? "bg-yellow-500" : "bg-green-500",
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function BudgetView({ projects, projectBurnMap }: BudgetViewProps) {
  // Projects with budgets
  const budgetedProjects = projects.filter((p) => p.budgetHours != null && p.budgetHours > 0);

  if (budgetedProjects.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">budget burn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgetedProjects.map((project) => {
          const burned = projectBurnMap.get(project.id) ?? 0;
          const budget = project.budgetHours ?? 0;
          const atRisk = budget > 0 && burned / budget >= 0.9;

          return (
            <div key={project.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate flex-1">{project.project}</span>
                {atRisk && (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    at risk
                  </Badge>
                )}
              </div>
              <BurnBar burned={burned} budget={budget} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
