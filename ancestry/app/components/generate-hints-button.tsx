"use client";

import { useState } from "react";

export function GenerateHintsButton({ treeId }: { treeId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    setDone(false);
    try {
      await fetch("/api/hints/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId }),
      });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={loading ? "animate-spin" : ""}
      >
        {loading ? (
          <>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </>
        ) : (
          <>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v4" />
            <path d="M11 16h.01" />
          </>
        )}
      </svg>
      {loading ? "searching..." : done ? "hints generated!" : "discover hints"}
    </button>
  );
}
