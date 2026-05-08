"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

interface SyncNowButtonProps {
  /** ISO timestamp of last sync (snapshot.generatedAt) */
  lastSyncedAt?: string | null;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "never";
  const diffMs = Date.now() - t;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function SyncNowButton({ lastSyncedAt }: SyncNowButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);

  const busy = pending || syncing;

  async function handleSync() {
    if (busy) return;
    setSyncing(true);
    try {
      await fetch("/api/cron/sync-social-stats", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("[strategy/sync-now] sync failed", err);
    } finally {
      setSyncing(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
      <span>last synced: {relTime(lastSyncedAt)}</span>
      <button
        type="button"
        onClick={handleSync}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        title="trigger a fresh marketing-stats sync"
      >
        <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
        <span>{busy ? "syncing" : "sync now"}</span>
      </button>
    </div>
  );
}
