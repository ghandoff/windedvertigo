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
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40 border border-white/15 rounded px-1.5 py-0.5">
            {item.kind === "rfp_outcome" ? "outcome" : item.kind}
          </span>
          <span className="text-sm font-medium text-white/90 truncate">{describeProposed(item)}</span>
        </div>
        <p className="text-xs text-white/60 break-words">{item.summary}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => act("dismiss")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md border border-white/15 px-2.5 py-1.5 text-white/70 hover:bg-white/5 disabled:opacity-50"
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
        {error && <span className="text-[10px] text-red-300">{error}</span>}
      </div>
    </div>
  );
}
