"use client";

import { useState } from "react";
import type { FinItem } from "@/lib/fin-data";

interface Props {
  item: FinItem;
}

function fmtAmount(cents: number | null, currency = "USD"): string {
  if (cents === null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function FinItemRow({ item }: Props) {
  const [status, setStatus] = useState(item.status);
  const [busy, setBusy] = useState(false);

  async function patch(update: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/fin/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } finally {
      setBusy(false);
    }
  }

  if (status === "actioned" || status === "dismissed") return null;

  const snoozeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const isOverdue = item.due_date && item.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
            {item.type.replace(/_/g, " ")}
          </span>
          {item.source && (
            <span className="text-[10px] text-muted-foreground">{item.source}</span>
          )}
          {isOverdue && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-600 dark:text-red-400">
              overdue
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium">{item.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          {item.due_date && <span>due {item.due_date}</span>}
          {item.amount_cents !== null && <span>{fmtAmount(item.amount_cents, item.currency)}</span>}
          {item.notes && <span className="line-clamp-1">{item.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          disabled={busy}
          onClick={() => patch({ status: "actioned" })}
          className="rounded px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
        >
          done
        </button>
        <button
          disabled={busy}
          onClick={() => patch({ status: "snoozed", snooze_until: snoozeUntil })}
          className="rounded px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors"
        >
          snooze 7d
        </button>
      </div>
    </div>
  );
}
