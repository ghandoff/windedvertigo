"use client";

import { useTransition } from "react";
import { resetHintsAction } from "./actions";

export function ResetButton({ pendingCount }: { pendingCount: number }) {
  const [pending, startTransition] = useTransition();

  if (pendingCount === 0) return null;

  return (
    <button
      onClick={() => {
        if (!confirm(`clear all ${pendingCount} pending matches and re-scan?`)) return;
        startTransition(() => resetHintsAction());
      }}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      )}
      {pending ? "resetting..." : "reset & re-scan"}
    </button>
  );
}
