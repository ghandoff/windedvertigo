"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, RotateCcw } from "lucide-react";

export interface ActionStatusToggleProps {
  actionId: string;
  initialStatus: "open" | "done" | "cancelled";
  /** Compact rendering for inline use in dense lists. */
  compact?: boolean;
}

/**
 * Client island for toggling an action item's status.
 *
 * - Open → buttons: "done", "skip" (cancel)
 * - Done → button: "reopen"
 * - Cancelled → button: "reopen"
 *
 * Optimistic UI: status flips immediately, server-confirms in background.
 * On failure: rolls back + shows error icon briefly.
 */
export function ActionStatusToggle({
  actionId,
  initialStatus,
  compact = false,
}: ActionStatusToggleProps) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const update = (next: typeof status) => {
    const prev = status;
    setStatus(next);
    setError(false);
    startTransition(async () => {
      const res = await fetch(`/api/council/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(prev);
        setError(true);
        setTimeout(() => setError(false), 2500);
      } else {
        // Soft refresh server-fetched counts (My Actions tab + meeting detail)
        router.refresh();
      }
    });
  };

  const cls = compact
    ? "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
    : "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border";

  if (status === "open") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => update("done")}
          disabled={isPending}
          className={`${cls} border-[#43b187]/50 text-[#43b187] hover:bg-[#43b187]/10`}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          done
        </button>
        <button
          onClick={() => update("cancelled")}
          disabled={isPending}
          className={`${cls} border-muted text-muted-foreground hover:bg-muted/20`}
          title="mark as cancelled / no longer relevant"
        >
          <X className="h-3 w-3" />
          skip
        </button>
        {error && <span className="text-[10px] text-[#b15043]">save failed</span>}
      </div>
    );
  }

  // Done or cancelled — show a reopen button.
  const label = status === "done" ? "done" : "cancelled";
  return (
    <div className="flex items-center gap-1.5">
      <span className={`${cls} ${status === "done" ? "border-[#43b187]/30 text-[#43b187] bg-[#43b187]/5" : "border-muted/40 text-muted-foreground bg-muted/10 line-through"}`}>
        {label}
      </span>
      <button
        onClick={() => update("open")}
        disabled={isPending}
        className={`${cls} border-[#5872cb]/40 text-[#5872cb] hover:bg-[#5872cb]/10`}
        title="reopen this action"
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        reopen
      </button>
      {error && <span className="text-[10px] text-[#b15043]">save failed</span>}
    </div>
  );
}
