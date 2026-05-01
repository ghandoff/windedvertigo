import Link from "next/link";
import { fetchSessionHistory } from "@/lib/notion";
import type { SessionHistoryEntry } from "@/lib/notion";

export const revalidate = 60; // ISR — revalidate every minute

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function HistoryPage() {
  let sessions: SessionHistoryEntry[] = [];
  let error = false;

  try {
    sessions = await fetchSessionHistory();
  } catch {
    error = true;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            session history
          </h1>
          <p className="text-sm text-[var(--rh-text-muted)]">
            past facilitated sessions and their results.
          </p>
        </div>
        <Link
          href="/facilitate"
          className="px-4 py-2 rounded-full text-sm font-medium border border-black/10 hover:bg-black/5 transition-colors"
        >
          &larr; back
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 mb-6">
          could not load session history. check that NOTION_API_KEY is set.
        </div>
      )}

      {!error && sessions.length === 0 && (
        <div className="text-center py-16 text-[var(--rh-text-muted)]">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-sm">no sessions recorded yet.</p>
          <p className="text-xs mt-1">
            sessions are saved automatically when you end them.
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/facilitate/history/${s.id}`}
              className="block p-5 rounded-2xl border border-black/10 bg-white hover:border-[var(--rh-cyan)] hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg group-hover:text-[var(--rh-teal)] transition-colors truncate">
                    {s.sessionName}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--rh-text-muted)]">
                    <span className="font-mono">{s.code}</span>
                    {s.template && (
                      <>
                        <span>·</span>
                        <span>{s.template}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--rh-text-muted)]">
                    <span>{formatDate(s.date)}</span>
                    <span>·</span>
                    <span>{s.participantCount} participants</span>
                    <span>·</span>
                    <span>{s.activityCount} activities</span>
                  </div>
                </div>
                <span className="text-[var(--rh-text-muted)] group-hover:text-[var(--rh-teal)] transition-colors mt-1">
                  &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
