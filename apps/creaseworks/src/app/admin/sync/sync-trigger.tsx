"use client";

/**
 * Sync trigger — auto-fires a full Notion → Postgres sync on mount.
 *
 * Renders as a status card that shows progress, then per-table counts
 * once complete. Includes a re-sync button for subsequent pulls.
 *
 * Only mounted when the admin/collective user opens the manage panel,
 * so there's no cost on regular profile views.
 */

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api-url";

interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  materialsCount?: number;
  playdatesCount?: number;
  collectionsCount?: number;
  packsCount?: number;
  runsCount?: number;
  cmsPageCount?: number;
  elapsedSeconds?: string;
}

export default function SyncTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const runSync = useCallback(async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(apiUrl("/api/admin/sync"), {
        method: "POST",
      });
      const data: SyncResult = await res.json();

      if (res.ok) {
        setResult({ ...data, success: true });
      } else {
        setResult({
          success: false,
          error: data.error || "sync failed.",
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || "network error.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // auto-fire on mount
  useEffect(() => {
    runSync();
  }, [runSync]);

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "rgba(39, 50, 72, 0.1)",
        backgroundColor: "var(--wv-white)",
      }}
    >
      {/* loading state */}
      {loading && (
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 rounded-full border-2 animate-spin"
            style={{
              borderColor: "var(--wv-sienna)",
              borderTopColor: "transparent",
            }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--wv-sienna)" }}
          >
            syncing from notion…
          </span>
        </div>
      )}

      {/* success: show per-table counts */}
      {result?.success && !loading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">✅</span>
            <span className="text-sm font-medium" style={{ color: "var(--wv-cadet)" }}>
              sync complete
              {result.elapsedSeconds && (
                <span className="font-normal text-cadet/40">
                  {" "}— {result.elapsedSeconds}s
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <CountPill label="materials" count={result.materialsCount} />
            <CountPill label="playdates" count={result.playdatesCount} />
            <CountPill label="collections" count={result.collectionsCount} />
            <CountPill label="packs" count={result.packsCount} />
            <CountPill label="runs" count={result.runsCount} />
            <CountPill label="pages" count={result.cmsPageCount} />
          </div>

          <button
            onClick={runSync}
            className="text-xs font-medium transition-colors"
            style={{ color: "var(--wv-sienna)", opacity: 0.6 }}
          >
            re-sync ↻
          </button>
        </div>
      )}

      {/* error state */}
      {result && !result.success && !loading && (
        <div>
          <div
            className="rounded-lg p-3 text-sm mb-3"
            style={{
              backgroundColor: "rgba(177, 80, 67, 0.08)",
              color: "var(--wv-redwood)",
            }}
          >
            {result.error || "sync failed."}
          </div>
          <button
            onClick={runSync}
            className="text-xs font-medium transition-colors"
            style={{ color: "var(--wv-sienna)" }}
          >
            retry ↻
          </button>
        </div>
      )}
    </div>
  );
}

/* ── helper ── */

function CountPill({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  if (count == null) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        backgroundColor: "rgba(39, 50, 72, 0.05)",
        color: "var(--wv-cadet)",
      }}
    >
      <span className="font-semibold">{count}</span>
      <span style={{ opacity: 0.5 }}>{label}</span>
    </span>
  );
}
