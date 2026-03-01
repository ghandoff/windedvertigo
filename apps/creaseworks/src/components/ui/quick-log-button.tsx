"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api-url";

interface QuickLogButtonProps {
  playdateId: string;
  playdateTitle: string;
  /** Playdate slug for deep-linking to the full reflection form. */
  playdateSlug?: string;
}

/**
 * Lightweight "I tried this!" button — creates a minimal run entry
 * without requiring the full reflection form.
 *
 * After logging, shows an expandable toast nudging the user to add a
 * photo for bonus engagement credit. The toast auto-dismisses after
 * 5 seconds unless the user hovers over it.
 */
export default function QuickLogButton({
  playdateId,
  playdateTitle,
  playdateSlug,
}: QuickLogButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [showPhotoNudge, setShowPhotoNudge] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Auto-dismiss the photo nudge after 5s unless hovered
  useEffect(() => {
    if (!showPhotoNudge || hovered) return;
    const timer = setTimeout(() => setShowPhotoNudge(false), 5000);
    return () => clearTimeout(timer);
  }, [showPhotoNudge, hovered]);

  const handleClick = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(apiUrl("/api/runs"), {
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
      // Show photo nudge after a brief moment
      setTimeout(() => setShowPhotoNudge(true), 400);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [playdateId, playdateTitle]);

  const photoHref = playdateSlug
    ? `/reflections/new?playdate=${playdateSlug}`
    : "/reflections/new";

  if (state === "done") {
    return (
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-cadet/60 bg-champagne/20">
          ✓ logged
        </span>

        {/* expandable photo nudge toast — auto-dismisses after 5s */}
        {showPhotoNudge && (
          <div
            className="flex items-center gap-2 rounded-lg bg-sienna/8 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-1 duration-300"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <span className="text-base">📸</span>
            <span className="text-cadet/60 text-xs">
              add a photo for +2 credit
            </span>
            <Link
              href={photoHref}
              className="ml-auto rounded-md bg-sienna/15 px-3 py-1 text-xs font-medium text-sienna hover:bg-sienna/25 transition-colors"
            >
              add photo
            </Link>
            <button
              onClick={() => setShowPhotoNudge(false)}
              className="text-cadet/30 hover:text-cadet/60 text-xs transition-colors"
              aria-label="dismiss"
            >
              ✕
            </button>
          </div>
        )}
      </div>
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

