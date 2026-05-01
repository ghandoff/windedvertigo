"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { getPendingCount } from "@/lib/pwa/offline-store";
import { syncQueue } from "@/lib/pwa/sync-manager";

export function SyncIndicator() {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPending(count);
    } catch {
      // IndexedDB may not be available in SSR
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pending > 0) {
      handleSync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSync() {
    if (syncing || !isOnline) return;
    setSyncing(true);
    try {
      await syncQueue();
      await refreshCount();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Online/offline indicator */}
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-500" />
      )}

      {/* Pending count + sync button */}
      {pending > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing || !isOnline}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {pending} pending
        </button>
      )}
    </div>
  );
}
