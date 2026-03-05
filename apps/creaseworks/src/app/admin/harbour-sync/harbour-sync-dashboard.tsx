"use client";

/**
 * Harbour sync dashboard — two-card UI for triggering Notion CMS content
 * syncs and force-redeploying Vercel apps.
 *
 * Card A: dispatches the GitHub Actions `sync-notion.yml` workflow, which
 * runs `fetch-notion.js`, commits updated JSON, and auto-deploys via Vercel.
 *
 * Card B: force-redeploys selected harbour ecosystem apps without requiring
 * a content change — useful after env var updates or config tweaks.
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

interface RedeployAppResult {
  app: string;
  success: boolean;
  error?: string;
  url?: string;
}

interface RedeployResult {
  results: RedeployAppResult[];
  error?: string;
}

/* ── app list (matches redeploy route) ── */

const ALL_APPS = [
  "site",
  "harbour",
  "creaseworks",
  "deep-deck",
  "vertigo-vault",
  "nordic-sqr-rct",
] as const;

/* ── main component ── */

export default function HarbourSyncDashboard() {
  return (
    <div className="space-y-6">
      <NotionSyncCard />
      <RedeployCard />
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

/* ── Card B: Force redeploy ── */

function RedeployCard() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ALL_APPS),
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RedeployAppResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleApp = (app: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });
  };

  const triggerRedeploy = useCallback(async () => {
    const apps = Array.from(selected);
    if (apps.length === 0) return;

    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/admin/harbour-sync/redeploy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps }),
      });
      const data: RedeployResult = await res.json();

      if (res.ok) {
        setResults(data.results);
      } else {
        setError(data.error || "redeploy failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "network error.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "rgba(39, 50, 72, 0.1)",
        backgroundColor: "var(--wv-white)",
      }}
    >
      <SectionHeading icon="🚀" title="force redeploy" />
      <p
        className="text-xs mb-4"
        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
      >
        redeploys harbour ecosystem apps without a content change. useful after
        environment variable updates or config tweaks.
      </p>

      {/* app checkboxes */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ALL_APPS.map((app) => (
          <label
            key={app}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs cursor-pointer transition-colors select-none"
            style={{
              backgroundColor: selected.has(app)
                ? "rgba(39, 50, 72, 0.08)"
                : "rgba(39, 50, 72, 0.03)",
              color: "var(--wv-cadet)",
              opacity: selected.has(app) ? 1 : 0.4,
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(app)}
              onChange={() => toggleApp(app)}
              className="sr-only"
            />
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: selected.has(app)
                  ? "var(--wv-sienna)"
                  : "transparent",
                border: selected.has(app)
                  ? "none"
                  : "1px solid rgba(39, 50, 72, 0.2)",
              }}
            />
            {app}
          </label>
        ))}
      </div>

      {/* trigger button */}
      {!loading && !results && !error && (
        <button
          onClick={triggerRedeploy}
          disabled={selected.size === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-30"
          style={{
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
          }}
        >
          force redeploy {selected.size > 0 ? `(${selected.size})` : ""}
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
            deploying {selected.size} app{selected.size !== 1 ? "s" : ""}…
          </span>
        </div>
      )}

      {/* results */}
      {results && !loading && (
        <div>
          <div className="space-y-2 mb-4">
            {results.map((r) => (
              <div key={r.app} className="flex items-center gap-2 text-sm">
                <span className="text-xs">{r.success ? "✅" : "❌"}</span>
                <span
                  className="font-medium"
                  style={{ color: "var(--wv-cadet)" }}
                >
                  {r.app}
                </span>
                {r.success && r.url && (
                  <span className="text-xs" style={{ opacity: 0.4 }}>
                    → {r.url}
                  </span>
                )}
                {!r.success && r.error && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--wv-redwood)", opacity: 0.7 }}
                  >
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setResults(null);
              setError(null);
            }}
            className="text-xs font-medium transition-colors"
            style={{ color: "var(--wv-sienna)", opacity: 0.6 }}
          >
            redeploy again ↻
          </button>
        </div>
      )}

      {/* error (top-level) */}
      {error && !loading && (
        <div>
          <ErrorBox message={error} />
          <button
            onClick={() => {
              setResults(null);
              setError(null);
            }}
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
