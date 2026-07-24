/**
 * /vinay — garrett's personal-assistant dashboard (phase 1, read-only).
 * Owner-only: non-garrett sessions get notFound() (don't even leak that it
 * exists). Shows the latest anticipation brief, what vinay perceived, open
 * commitments, and the sweep heartbeat. Not linked from the shared nav.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { isVinayOwner } from "@/lib/oauth/config";
import { PageHeader } from "@/app/components/page-header";
import { getLatestVinayBrief } from "@/lib/vinay/briefs";
import { listRecentVinayEvents } from "@/lib/vinay/events";
import { listVinayCommitments } from "@/lib/vinay/commitments";
import { getLatestVinayRun } from "@/lib/vinay/runs";
import { GradeControl } from "./components/grade-control";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function VinayPage() {
  const session = await auth();
  if (!isVinayOwner(session?.user?.email)) notFound();

  const [brief, events, commitments, lastRun] = await Promise.all([
    getLatestVinayBrief().catch(() => null),
    listRecentVinayEvents({ limit: 50 }).catch(() => []),
    listVinayCommitments({ openOnly: true, limit: 50 }).catch(() => []),
    getLatestVinayRun("anticipation").catch(() => null),
  ]);

  const heartbeatError = lastRun?.status === "error";

  return (
    <>
      <PageHeader title="vinay" description="your personal assistant · read-only anticipation (phase 1)">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </PageHeader>

      {/* sweep heartbeat — turns red on a failed run so a silent no-op is visible */}
      <div
        className={`mb-4 rounded-lg border px-4 py-2.5 text-xs flex items-center justify-between gap-3 ${
          heartbeatError ? "border-red-500/40 bg-red-500/10 text-red-600" : "border-border bg-muted/40 text-muted-foreground"
        }`}
      >
        <span className="truncate">
          last sweep:{" "}
          <span className="font-medium text-foreground">{lastRun ? `${lastRun.status} · ${relTime(lastRun.ran_at)}` : "never"}</span>
          {lastRun?.detail ? <span className="ml-1">— {lastRun.detail}</span> : null}
        </span>
        <span className="text-[11px] shrink-0">
          runs daily · <code className="font-mono">vinay_brief</code> in cowork
        </span>
      </div>

      {/* the brief */}
      <section className="rounded-lg border border-border p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-semibold">{brief ? `brief — ${brief.brief_date}` : "no brief yet"}</h2>
          {brief ? <GradeControl briefId={brief.id} /> : null}
        </div>
        {brief ? (
          <>
            {brief.body ? <div className="text-sm whitespace-pre-wrap text-foreground/90">{brief.body}</div> : null}
            {brief.items?.length ? (
              <ul className="mt-3 space-y-1.5">
                {brief.items.map((it) => (
                  <li key={it.key} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{it.title}</span>
                      {it.detail ? <span className="text-muted-foreground"> — {it.detail}</span> : null}
                    </span>
                    <GradeControl briefId={brief.id} itemKey={it.key} />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">the daily sweep hasn&apos;t produced a brief yet.</p>
        )}
      </section>

      {/* perceived events + open commitments */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold mb-2">perceived ({events.length})</h2>
          <ul className="space-y-1 text-sm">
            {events.length ? (
              events.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-24 shrink-0">{e.source}</span>
                  <span className="truncate">{e.title}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">nothing perceived yet</li>
            )}
          </ul>
        </section>
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold mb-2">open commitments ({commitments.length})</h2>
          <ul className="space-y-1 text-sm">
            {commitments.length ? (
              commitments.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{c.what}</span>
                  {c.due_date ? <span className="text-[11px] text-muted-foreground shrink-0">{c.due_date}</span> : null}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">none</li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}
