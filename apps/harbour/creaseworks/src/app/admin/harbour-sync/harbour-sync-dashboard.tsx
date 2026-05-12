"use client";

/**
 * Harbour sync dashboard — UI for triggering Notion CMS content syncs.
 *
 * Card A: dispatches the GitHub Actions `sync-notion.yml` workflow, which
 * runs `fetch-notion.js` and commits updated JSON. (Force-redeploy card
 * removed 2026-05-12 with the Vercel migration — all harbour apps deploy
 * via wrangler/OpenNext now; trigger a redeploy from your laptop.)
 */

import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/api-url";

/* ── types ── */

interface NotionSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  runUrl?: string | null;
  runStatus?: string | null;
}

/* ── main component ── */

export default function HarbourSyncDashboard() {
  return (
    <div className="space-y-6">
      <NotionSyncCard />
    </div>
  );
}

/* ── Card A: Notion CMS sync ── */

function NotionSyncCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NotionSyncResult | null>(null);

  const triggerSync = useCallback(async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(apiUrl("/api/admin/harbour-sync/notion"), {
        method: "POST",
      });
      const data: NotionSyncResult = await res.json();

      if (res.ok) {
        setResult({ ...data, success: true });
      } else {
        setResult({
          success: false,
          error: data.error || "dispatch failed.",
        });
      }
    } catch (err: unknown) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "network error.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "rgba(39, 50, 72, 0.1)",
        backgroundColor: "var(--wv-white)",
      }}
    >
      <SectionHeading icon="📡" title="notion CMS sync" />
      <p
        className="text-xs mb-4"
        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
      >
        triggers the GitHub Actions workflow that fetches Notion content and
        commits updated JSON files. if content changed, Vercel auto-deploys
        affected apps.
      </p>

      {/* idle / trigger button */}
      {!loading && !result && (
        <button
          onClick={triggerSync}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
          }}
        >
          sync notion content
        </button>
      )}

      {/* loading */}
      {loading && (
        <div className="flex items-center gap-3">
          <Spinner />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--wv-sienna)" }}
          >
            dispatching workflow…
          </span>
        </div>
      )}

      {/* success */}
      {result?.success && !loading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">✅</span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--wv-cadet)" }}
            >
              {result.message || "workflow dispatched"}
              {result.runStatus && (
                <span className="font-normal" style={{ opacity: 0.4 }}>
                  {" "}
                  — {result.runStatus}
                </span>
              )}
            </span>
          </div>

          {result.runUrl && (
            <a
              href={result.runUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs underline mb-3 transition-opacity hover:opacity-80"
              style={{ color: "var(--wv-sienna)" }}
            >
              view workflow run ↗
            </a>
          )}

          <div>
            <button
              onClick={triggerSync}
              className="text-xs font-medium transition-colors"
              style={{ color: "var(--wv-sienna)", opacity: 0.6 }}
            >
              re-sync ↻
            </button>
          </div>
        </div>
      )}

      {/* error */}
      {result && !result.success && !loading && (
        <div>
          <ErrorBox message={result.error || "dispatch failed."} />
          <button
            onClick={triggerSync}
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

/* ── shared helpers ── */

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg" role="img" aria-hidden>
        {icon}
      </span>
      <h2
        className="text-sm font-semibold tracking-tight"
        style={{ color: "var(--wv-cadet)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 animate-spin"
      style={{
        borderColor: "var(--wv-sienna)",
        borderTopColor: "transparent",
      }}
    />
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg p-3 text-sm mb-3"
      style={{
        backgroundColor: "rgba(177, 80, 67, 0.08)",
        color: "var(--wv-redwood)",
      }}
    >
      {message}
    </div>
  );
}
