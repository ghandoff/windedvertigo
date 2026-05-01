"use client";

import { useState } from "react";
import { CalendarDays, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface SyncResult {
  created: number;
  skipped: number;
  totalEvents: number;
  from: string;
  to: string;
}

export function CalendarSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync(from: string, to: string) {
    setLoading(true);
    setResult(null);
    setError(null);
    setNeedsReauth(false);

    try {
      const res = await fetch("/api/user/calendar/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ from, to }),
      });

      const data = await res.json() as {
        error?: string;
        message?: string;
        ok?: boolean;
        created?: number;
        skipped?: number;
        totalEvents?: number;
        from?: string;
        to?: string;
      };

      if (res.status === 403 && data.error === "no_calendar_token") {
        setNeedsReauth(true);
        return;
      }

      if (!res.ok) {
        setError(data.message ?? data.error ?? "sync failed");
        return;
      }

      setResult({
        created:     data.created     ?? 0,
        skipped:     data.skipped     ?? 0,
        totalEvents: data.totalEvents ?? 0,
        from:        data.from        ?? from,
        to:          data.to          ?? to,
      });
    } catch {
      setError("network error — try again");
    } finally {
      setLoading(false);
    }
  }

  const thisYear       = new Date().getFullYear();
  const today          = new Date().toISOString().split("T")[0];
  const jan1           = `${thisYear}-01-01`;
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2.5 mt-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">sync from google calendar</span>
      </div>

      {needsReauth ? (
        <div className="space-y-1.5">
          <p className="text-xs text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Calendar access not yet granted.{" "}
              <a href="/api/auth/signout" className="underline underline-offset-2">Sign out</a>
              {" "}and sign back in — you&apos;ll see a Google prompt to allow calendar access.
              After that, come back here and sync.
            </span>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSync(thisMonthStart, today)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium bg-background hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
            this month
          </button>
          <button
            onClick={() => handleSync(jan1, today)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium bg-background hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
            since jan 1 (backfill)
          </button>
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          syncing… this may take a moment for large date ranges
        </p>
      )}

      {result && !loading && (
        <p className="text-xs text-green-700 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {result.created} new entries added
          {result.skipped > 0 ? `, ${result.skipped} already existed` : ""}
          {" "}({result.totalEvents} calendar events scanned)
        </p>
      )}

      {error && !loading && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
