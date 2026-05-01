"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface MobileTimeEntryProps {
  recentTasks: { id: string; name: string }[];
}

export function MobileTimeEntry({ recentTasks }: MobileTimeEntryProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Timer
  const startTimer = useCallback(() => {
    startRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
  }, [elapsed]);

  const stopTimer = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (startRef.current) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleSave = useCallback(async () => {
    if (elapsed < 60) return; // at least 1 minute
    setSaving(true);

    const hours = Math.round((elapsed / 3600) * 100) / 100;
    const today = new Date().toISOString().split("T")[0];
    const taskName = selectedTaskId ? recentTasks.find((t) => t.id === selectedTaskId)?.name : "";

    const body: Record<string, unknown> = {
      entry: description || taskName || "time entry",
      hours,
      billable: true,
      status: "draft",
      dateAndTime: { start: today },
    };
    if (selectedTaskId) body.taskIds = [selectedTaskId];

    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setRunning(false);
        setElapsed(0);
        startRef.current = null;
        setDescription("");
        setSelectedTaskId("");
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          router.refresh();
        }, 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [elapsed, description, selectedTaskId, recentTasks, router]);

  if (saved) {
    return (
      <div className="flex flex-col items-center py-8 gap-2">
        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-sm font-medium">time logged</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Big timer display + start/stop */}
      <div className="flex flex-col items-center gap-3 py-4">
        <span className="text-4xl font-mono tabular-nums tracking-wider">
          {formatElapsed(elapsed)}
        </span>
        <button
          onClick={running ? stopTimer : startTimer}
          className={cn(
            "h-16 w-16 rounded-full flex items-center justify-center transition-colors shadow-md",
            running
              ? "bg-red-500 text-white active:bg-red-600"
              : "bg-green-500 text-white active:bg-green-600",
          )}
        >
          {running ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
        </button>
      </div>

      {/* Task picker — most important, shown prominently */}
      {recentTasks.length > 0 && (
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full px-3 py-3 text-base border rounded-lg bg-background"
        >
          <option value="">select task...</option>
          {recentTasks.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      {/* Description */}
      <input
        type="text"
        placeholder="notes (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full px-3 py-3 text-base border rounded-lg bg-background"
      />

      {/* Save button — only shown when timer is stopped and has time */}
      {!running && elapsed >= 60 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-medium bg-foreground text-background rounded-lg active:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          {saving ? "saving..." : `log ${(elapsed / 3600).toFixed(1)}h`}
        </button>
      )}
    </div>
  );
}
