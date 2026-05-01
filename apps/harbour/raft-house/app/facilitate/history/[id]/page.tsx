import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchSessionResult } from "@/lib/notion";

export const revalidate = 300; // ISR — 5 min

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchSessionResult(id);

  if (!data) notFound();

  const { entry, results } = data;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link
        href="/facilitate/history"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--rh-text-muted)] hover:text-[var(--rh-teal)] transition-colors mb-6"
      >
        &larr; all sessions
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          {entry.sessionName}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--rh-text-muted)]">
          <span className="font-mono bg-[var(--rh-sand)] px-2 py-0.5 rounded-full text-xs">
            {entry.code}
          </span>
          {entry.template && <span>{entry.template}</span>}
          <span>·</span>
          <span>{formatDate(entry.date)}</span>
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm text-[var(--rh-text-muted)]">
          {entry.facilitator && (
            <span>facilitator: {entry.facilitator}</span>
          )}
          <span>{entry.participantCount} participants</span>
          <span>{entry.activityCount} activities</span>
        </div>
      </div>

      {/* results rendered as preformatted text (it's markdown) */}
      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--rh-text-muted)] mb-4">
          session results
        </h2>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed font-[inherit] text-[var(--rh-text)]">
          {results || "no results recorded."}
        </pre>
      </div>
    </div>
  );
}
