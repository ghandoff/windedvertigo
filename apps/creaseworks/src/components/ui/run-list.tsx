"use client";

/**
 * Run list — client component displaying runs in a card grid.
 *
 * Shows run type, date, playdate, context tags, trace evidence,
 * and optionally what_changed / next_iteration.
 *
 * MVP 5 — runs and evidence.
 */

import Link from "next/link";

interface RunMaterial {
  id: string;
  title: string;
}

interface Run {
  id: string;
  title: string;
  playdate_title: string | null;
  playdate_slug: string | null;
  run_type: string | null;
  run_date: string | null;
  context_tags: string[];
  trace_evidence: string[];
  what_changed: string | null;
  next_iteration: string | null;
  materials: RunMaterial[];
  created_by: string | null;
  created_at: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const TYPE_COLOURS: Record<string, string> = {
  "internal practice": "var(--wv-cadet)",
  "webinar": "var(--wv-sienna)",
  "delivery": "var(--wv-redwood)",
  "BD/prospect": "var(--wv-cadet)",
  "R&D": "var(--wv-cadet)",
};

export default function RunList({
  runs,
  currentUserId,
  isAdmin,
  isInternal = false,
}: {
  runs: Run[];
  currentUserId: string;
  isAdmin: boolean;
  /** Internal users (admin or windedvertigo.com) see reflective fields on all runs */
  isInternal?: boolean;
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-8 text-center">
        <p className="text-2xl mb-3" aria-hidden>📝</p>
        <p className="text-cadet/60 text-sm mb-4">
          your reflections will show up here — try a playdate and log what you noticed!
        </p>
        <Link
          href="/reflections/new"
          className="inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          log a reflection
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <div
          key={run.id}
          className="rounded-xl border border-cadet/10 bg-champagne/30 p-5 transition-all hover:border-cadet/20"
        >
          {/* header row */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold tracking-tight truncate">
                {run.title}
              </h3>
              {run.playdate_title && (
                <p className="text-xs text-cadet/50 mt-0.5">
                  playdate:{" "}
                  {run.playdate_slug ? (
                    <Link
                      href={`/sampler`}
                      className="underline hover:text-cadet/70 transition-colors"
                    >
                      {run.playdate_title}
                    </Link>
                  ) : (
                    run.playdate_title
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {run.run_type && (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium text-white"
                  style={{
                    backgroundColor: TYPE_COLOURS[run.run_type] || "var(--wv-cadet)",
                  }}
                >
                  {run.run_type}
                </span>
              )}
              <span className="text-xs text-cadet/50">
                {formatDate(run.run_date)}
              </span>
            </div>
          </div>

          {/* tags row */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(run.context_tags || []).map((tag: string) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(39, 50, 72, 0.06)",
                  color: "var(--wv-cadet)",
                }}
              >
                {tag}
              </span>
            ))}
            {(run.trace_evidence || []).map((ev: string) => (
              <span
                key={ev}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(177, 80, 67, 0.08)",
                  color: "var(--wv-redwood)",
                }}
              >
                {ev}
              </span>
            ))}
          </div>

          {/* materials */}
          {run.materials.length > 0 && (
            <p className="text-xs text-cadet/50 mb-2">
              materials used:{" "}
              {run.materials.map((m) => m.title).join(", ")}
            </p>
          )}

          {/* reflective fields — visible to internal users on all runs,
              external users only on their own runs */}
          {(isInternal || run.created_by === currentUserId) && (
            <>
              {run.what_changed && (
                <div className="mt-3 pt-3 border-t border-cadet/5">
                  <p className="text-xs font-semibold text-cadet/60 mb-1">
                    what changed
                  </p>
                  <p className="text-sm text-cadet/70">{run.what_changed}</p>
                </div>
              )}
              {run.next_iteration && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-cadet/60 mb-1">
                    next iteration
                  </p>
                  <p className="text-sm text-cadet/70">{run.next_iteration}</p>
                </div>
              )}
            </>
          )}

          {/* edit link — only for own runs */}
          {run.created_by === currentUserId && (
            <div className="mt-3 pt-3 border-t border-cadet/5">
              <span className="text-xs text-cadet/30">
                you created this reflection
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
