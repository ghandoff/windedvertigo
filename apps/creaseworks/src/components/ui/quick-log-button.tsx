"use client";

import { useState } from "react";

interface QuickLogButtonProps {
  playdateId: string;
  playdateTitle: string;
}

/**
 * Lightweight "I tried this!" button — creates a minimal run entry
 * without requiring the full reflection form.
 */
export default function QuickLogButton({
  playdateId,
  playdateTitle,
}: QuickLogButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: playdateTitle,
          playdateId,
          runType: "quick log",
          runDate: new Date().toISOString().slice(0, 10),
          contextTags: [],
          traceEvidence: [],
          whatChanged: null,
          nextIteration: null,
          materialIds: [],
        }),
      });
      if (!res.ok) throw new Error("failed");
      setState("done");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-cadet/60 bg-champagne/20">
        ✓ logged
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-cadet/15 px-4 py-2 text-sm font-medium text-cadet/70 hover:border-sienna/40 hover:text-cadet transition-all disabled:opacity-50"
    >
      {state === "loading" ? "logging…" : state === "error" ? "try again" : "✓ I tried this!"}
    </button>
  );
}
