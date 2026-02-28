"use client";

/**
 * Sync trigger button — client component.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { useState } from "react";
import { apiUrl } from "@/lib/api-url";

export default function SyncTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(apiUrl("/api/admin/sync"), {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || "sync completed successfully." });
      } else {
        setResult({ success: false, message: data.error || "sync failed." });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || "network error." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-6">
      <button
        onClick={handleSync}
        disabled={loading}
        className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
        style={{ backgroundColor: "var(--wv-redwood)" }}
      >
        {loading ? "syncing…" : "sync now"}
      </button>

      {result && (
        <div
          className="mt-4 rounded-lg p-3 text-sm"
          style={{
            backgroundColor: result.success
              ? "rgba(42, 157, 80, 0.08)"
              : "rgba(177, 80, 67, 0.08)",
            color: result.success ? "var(--color-success)" : "var(--wv-redwood)",
          }}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}

