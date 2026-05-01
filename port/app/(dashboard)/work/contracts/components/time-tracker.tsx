"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── timer logic ─────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function useTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    startRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
  }, [elapsed]);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
    startRef.current = null;
  }, [stop]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (startRef.current) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  return { running, elapsed, start, stop, reset };
}

// ── time tracker ────────────────────────────────────────

interface TimeTrackerProps {
  /** Recent work items for the task picker */
  recentTasks: { id: string; name: string }[];
}

export function TimeTracker({ recentTasks }: TimeTrackerProps) {
  const router = useRouter();
  const timer = useTimer();
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [description, setDescription] = useState("");
  const [manualHours, setManualHours] = useState("");
  const [mode, setMode] = useState<"timer" | "manual">("timer");
  const [saving, setSaving] = useState(false);
  const [billable, setBillable] = useState(true);

  const canSave =
    mode === "timer"
      ? !timer.running && timer.elapsed > 0
      : manualHours !== "" && parseFloat(manualHours) > 0;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);

    const hours =
      mode === "timer"
        ? Math.round((timer.elapsed / 3600) * 100) / 100
        : parseFloat(manualHours);

    const today = new Date().toISOString().split("T")[0];

    const body: Record<string, unknown> = {
      entry: description || (selectedTaskId ? recentTasks.find((t) => t.id === selectedTaskId)?.name : "") || "time entry",
      hours,
      billable,
      status: "draft",
      dateAndTime: { start: today },
    };

    if (selectedTaskId) {
      body.taskIds = [selectedTaskId];
    }

    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        timer.reset();
        setDescription("");
        setManualHours("");
        setSelectedTaskId("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }, [canSave, mode, timer, manualHours, description, selectedTaskId, billable, recentTasks, router]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          log time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <button
            onClick={() => setMode("timer")}
            className={cn(
              "flex-1 text-xs py-1.5 rounded transition-colors",
              mode === "timer" ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
            )}
          >
            timer
          </button>
          <button
            onClick={() => setMode("manual")}
            className={cn(
              "flex-1 text-xs py-1.5 rounded transition-colors",
              mode === "manual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
            )}
          >
            manual
          </button>
        </div>

        {/* Timer display */}
        {mode === "timer" && (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono tabular-nums tracking-wider">
              {formatElapsed(timer.elapsed)}
            </span>
            <button
              onClick={timer.running ? timer.stop : timer.start}
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                timer.running
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-green-100 text-green-600 hover:bg-green-200",
              )}
            >
              {timer.running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
          </div>
        )}

        {/* Manual hours input */}
        {mode === "manual" && (
          <input
            type="number"
            step="0.25"
            min="0"
            max="24"
            placeholder="hours (e.g. 1.5)"
            value={manualHours}
            onChange={(e) => setManualHours(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
          />
        )}

        {/* Task picker */}
        {recentTasks.length > 0 && (
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground"
          >
            <option value="">select task (optional)</option>
            {recentTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {/* Description */}
        <input
          type="text"
          placeholder="what did you work on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
        />

        {/* Billable toggle + save */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="rounded"
            />
            billable
          </label>

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? "saving..." : "log entry"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
