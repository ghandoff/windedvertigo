"use client";

import { useState } from "react";

const GRADES = ["useful", "not-useful", "wrong"] as const;

/** Tiny grade widget — posts to the session-gated /api/vinay/grade route. */
export function GradeControl({ briefId, itemKey }: { briefId: string; itemKey?: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function grade(g: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/vinay/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_id: briefId, grade: g, item_key: itemKey ?? null }),
      });
      if (res.ok) setDone(g);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-[11px] text-muted-foreground shrink-0">graded: {done}</span>;

  return (
    <span className="inline-flex gap-1 shrink-0">
      {GRADES.map((g) => (
        <button
          key={g}
          disabled={busy}
          onClick={() => grade(g)}
          className="text-[11px] rounded border border-border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
        >
          {g}
        </button>
      ))}
    </span>
  );
}
