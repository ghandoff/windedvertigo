"use client";

import { useState, useEffect } from "react";
import type { TimerState } from "@/lib/types";

export function TimerDisplay({ timer, compact }: { timer: TimerState; compact?: boolean }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function calc() {
      if (timer.pausedAt) {
        const elapsed = timer.pausedAt - timer.startedAt;
        return Math.max(0, timer.durationMs - elapsed);
      }
      const elapsed = Date.now() - timer.startedAt;
      return Math.max(0, timer.durationMs - elapsed);
    }

    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 250);
    return () => clearInterval(interval);
  }, [timer]);

  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isLow = seconds <= 10 && seconds > 0;
  const isDone = seconds === 0;

  return (
    <div
      className={`font-mono ${compact ? "text-sm" : "text-2xl"} font-bold tabular-nums ${
        isDone
          ? "text-red-500"
          : isLow
            ? "text-orange-500"
            : "text-[var(--rh-text)]"
      }`}
    >
      {minutes}:{secs.toString().padStart(2, "0")}
      {timer.pausedAt && (
        <span className="text-xs font-normal text-[var(--rh-text-muted)] ml-2">
          paused
        </span>
      )}
    </div>
  );
}
