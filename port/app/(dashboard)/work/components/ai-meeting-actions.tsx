"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Loader2, ChevronDown, ChevronUp, CalendarDays, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExtractedAction } from "@/lib/ai/meeting-actions";

interface AiMeetingActionsProps {
  /** Optional project ID to link created work items to */
  projectId?: string;
}

export function AiMeetingActions({ projectId }: AiMeetingActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [actions, setActions] = useState<ExtractedAction[] | null>(null);
  const [meetingSummary, setMeetingSummary] = useState("");
  const [creating, setCreating] = useState<Set<number>>(new Set());
  const [created, setCreated] = useState<Set<number>>(new Set());

  const handleExtract = useCallback(async () => {
    if (!notes.trim()) return;
    setExtracting(true);
    setActions(null);

    try {
      const res = await fetch("/api/ai/meeting-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (res.ok) {
        const data = await res.json();
        setActions(data.actions);
        setMeetingSummary(data.meetingSummary);
      }
    } finally {
      setExtracting(false);
    }
  }, [notes]);

  const handleCreateAction = useCallback(async (index: number) => {
    if (!actions) return;
    const action = actions[index];
    setCreating((prev) => new Set(prev).add(index));

    try {
      const body: Record<string, unknown> = {
        task: action.title,
        taskType: action.type,
        priority: action.priority,
        status: "in queue",
      };
      if (action.deadline) {
        body.dueDate = { start: action.deadline, end: null };
      }
      if (projectId) {
        body.projectIds = [projectId];
      }

      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  }, [actions, projectId, router]);

  const handleCreateAll = useCallback(async () => {
    if (!actions) return;
    for (let i = 0; i < actions.length; i++) {
      if (!created.has(i)) {
        await handleCreateAction(i);
      }
    }
  }, [actions, created, handleCreateAction]);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          extract actions from meeting
          {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          <textarea
            placeholder="paste meeting notes or transcript..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background resize-y"
          />

          <button
            onClick={handleExtract}
            disabled={extracting || !notes.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-40"
          >
            {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {extracting ? "extracting..." : "extract actions"}
          </button>

          {actions && (
            <div className="space-y-2 pt-2 border-t">
              {meetingSummary && (
                <p className="text-xs text-muted-foreground italic">{meetingSummary}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{actions.length} action items</span>
                {actions.length > 0 && created.size < actions.length && (
                  <button
                    onClick={handleCreateAll}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    create all →
                  </button>
                )}
              </div>

              {actions.map((action, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-md border transition-colors",
                    created.has(i) ? "bg-green-50/50 border-green-200" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">{action.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {action.owner !== "unassigned" && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <User className="h-2.5 w-2.5" />
                          {action.owner}
                        </span>
                      )}
                      {action.deadline && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {formatDate(action.deadline)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">{action.type}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{action.context}</p>
                  </div>

                  {created.has(i) ? (
                    <span className="text-[10px] text-green-600 font-medium shrink-0 mt-1">created</span>
                  ) : (
                    <button
                      onClick={() => handleCreateAction(i)}
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
