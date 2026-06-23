"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { ReviewItem } from "@/lib/review-queue";

function describeProposed(item: ReviewItem): string {
  if (item.kind === "rfp_outcome") return `set status → ${String(item.proposed.status ?? "?")}`;
  if (item.kind === "payment") {
    const amt = Number(item.proposed.received_amount);
    return Number.isFinite(amt)
      ? `record payment → received $${amt.toLocaleString("en-US")}`
      : "record payment";
  }
  return JSON.stringify(item.proposed);
}

export function ReviewCard({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "dismiss">(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "dismiss") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/review/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
            {item.kind === "rfp_outcome" ? "outcome" : item.kind}
          </span>
          <span className="text-sm font-medium text-foreground truncate">{describeProposed(item)}</span>
        </div>
        <p className="text-xs text-muted-foreground break-words">{item.summary}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => act("dismiss")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> {busy === "dismiss" ? "…" : "dismiss"}
        </button>
        <button
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md px-2.5 py-1.5 font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#43b187" }}
        >
          <Check className="h-3.5 w-3.5" /> {busy === "approve" ? "…" : "approve"}
        </button>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    </div>
  );
}
