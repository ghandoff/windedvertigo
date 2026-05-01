"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GeneratedTask } from "@/lib/ai/task-generation";

const TYPE_COLORS: Record<string, string> = {
  plan: "bg-blue-50 text-blue-600",
  design: "bg-purple-50 text-purple-600",
  research: "bg-indigo-50 text-indigo-600",
  implement: "bg-green-50 text-green-600",
  review: "bg-yellow-50 text-yellow-600",
  coordinate: "bg-teal-50 text-teal-600",
  admin: "bg-gray-50 text-gray-600",
};

interface AiTaskGeneratorProps {
  projectId: string;
  projectName: string;
}

export function AiTaskGenerator({ projectId, projectName }: AiTaskGeneratorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tasks, setTasks] = useState<GeneratedTask[] | null>(null);
  const [summary, setSummary] = useState("");
  const [creating, setCreating] = useState<Set<number>>(new Set());
  const [created, setCreated] = useState<Set<number>>(new Set());

  const handleGenerate = useCallback(async () => {
    if (!brief.trim()) return;
    setGenerating(true);
    setTasks(null);

    try {
      const res = await fetch("/api/ai/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, projectName }),
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setSummary(data.summary);
      }
    } finally {
      setGenerating(false);
    }
  }, [brief, projectName]);

  const handleCreateTask = useCallback(async (index: number) => {
    if (!tasks) return;
    const task = tasks[index];
    setCreating((prev) => new Set(prev).add(index));

    try {
      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task.title,
          taskType: task.type,
          priority: task.priority,
          estimateHours: task.estimateHours,
          status: "in queue",
          projectIds: [projectId],
        }),
      });

      if (res.ok) {
        setCreated((prev) => new Set(prev).add(index));
        router.refresh();
      }
    } finally {
      setCreating((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }, [tasks, projectId, router]);

  const handleCreateAll = useCallback(async () => {
    if (!tasks) return;
    for (let i = 0; i < tasks.length; i++) {
      if (!created.has(i)) {
        await handleCreateTask(i);
      }
    }
  }, [tasks, created, handleCreateTask]);

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          generate tasks from brief
          {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          <textarea
            placeholder="paste project brief, RFP scope, or description of work..."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background resize-y"
          />

          <button
            onClick={handleGenerate}
            disabled={generating || !brief.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-40"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? "generating..." : "generate tasks"}
          </button>

          {tasks && (
            <div className="space-y-2 pt-2 border-t">
              {summary && (
                <p className="text-xs text-muted-foreground">{summary}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{tasks.length} tasks generated</span>
                {tasks.length > 0 && created.size < tasks.length && (
                  <button
                    onClick={handleCreateAll}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    create all →
                  </button>
                )}
              </div>

              {tasks.map((task, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-md border transition-colors",
                    created.has(i) ? "bg-green-50/50 border-green-200" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[task.type] ?? ""}`}>
                        {task.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{task.estimateHours}h</span>
                      {task.priority !== "medium" && (
                        <span className="text-[10px] text-muted-foreground">{task.priority}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{task.description}</p>
                  </div>

                  {created.has(i) ? (
                    <span className="text-[10px] text-green-600 font-medium shrink-0 mt-1">created</span>
                  ) : (
                    <button
                      onClick={() => handleCreateTask(i)}
                      disabled={creating.has(i)}
                      className="shrink-0 mt-1 p-1 rounded hover:bg-muted transition-colors"
                      title="create work item"
                    >
                      {creating.has(i) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
