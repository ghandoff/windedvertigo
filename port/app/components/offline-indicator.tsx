"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { count, flush } from "@/lib/offline-queue";

/**
 * Offline indicator — shows a minimal pill when the user is offline
 * or when there are queued API requests waiting to sync.
 *
 * Invisible when online with an empty queue.
 * Auto-flushes the queue when connectivity returns.
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setPending(await count());
    } catch {
      // indexeddb unavailable (ssr, incognito, etc.)
    }
  }, []);

  // Poll pending count
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 4_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Auto-flush when coming back online
  useEffect(() => {
    if (!isOnline) return;
    if (flushingRef.current) return;

    const doFlush = async () => {
      const n = await count().catch(() => 0);
      if (n === 0) return;

      flushingRef.current = true;
      setFlushing(true);
      try {
        await flush();
      } finally {
        flushingRef.current = false;
        setFlushing(false);
        refreshCount();
      }
    };

    doFlush();
  }, [isOnline, refreshCount]);

  // Nothing to show
  if (isOnline && pending === 0 && !flushing) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-[11px] tracking-wide backdrop-blur-sm shadow-lg flex items-center gap-1.5 pointer-events-auto">
        {!isOnline && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span>offline</span>
          </>
        )}
        {isOnline && flushing && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>syncing...</span>
          </>
        )}
        {pending > 0 && (
          <span className="text-slate-400">
            {isOnline && !flushing ? "" : " \u2014 "}
            {pending} queued
          </span>
        )}
      </div>
    </div>
  );
}
