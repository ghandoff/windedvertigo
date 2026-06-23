/**
 * /biz — Biz's business-development dashboard.
 * Pipeline snapshot + bid deadlines (live from rfp_opportunities) + the roadmap
 * of available upgrades (biz_roadmap) + recent BD decisions.
 * The full RFP Lighthouse (intake, kanban, proposals) lives at /opportunities.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { getRecentBizDecisions, getRoadmap, type BizRoadmapItem } from "@/lib/biz-data";
import { fetchRevenueProgress } from "@/lib/marketing/revenue-progress";
import { getSocialStatsFromSnapshot } from "@/lib/marketing/social-stats";
import { countPendingReviews } from "@/lib/review-queue";
import { StrategyHero } from "./components/strategy-hero";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

const TERMINAL = new Set(["won", "lost", "no-go", "missed deadline"]);
const STAGE_ORDER = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default async function BizPage() {
  const [{ data: allOpps }, roadmap, decisions, revenueProgress, socialStats, pendingCount] = await Promise.all([
    getRfpOpportunitiesFromSupabase({}, { page: 1, pageSize: 500 }).catch(() => ({ data: [], total: 0 })),
    getRoadmap().catch((): BizRoadmapItem[] => []),
    getRecentBizDecisions(8).catch(() => []),
    fetchRevenueProgress().catch(() => null),
    getSocialStatsFromSnapshot().catch(() => null),
    countPendingReviews().catch(() => 0),
  ]);

  const active = allOpps.filter((o) => !TERMINAL.has(o.status));
  const pipelineValue = active.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);

  const byStage: Record<string, number> = {};
  for (const o of active) byStage[o.status] = (byStage[o.status] ?? 0) + 1;

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const deadlines = active
    .filter((o) => o.dueDate?.start && o.dueDate.start >= today && o.dueDate.start <= cutoff)
    .sort((a, b) => (a.dueDate!.start).localeCompare(b.dueDate!.start));

  const available = roadmap.filter((r) => r.status !== "shipped");
  const shippedCount = roadmap.length - available.length;
  const byPriority = (p: string) => available.filter((r) => r.priority === p);

  return (
    <>
      <PageHeader
        title="biz"
        description="business development — the RFP Lighthouse pipeline, bid deadlines, and the roadmap of available upgrades."
      >
        <Link
          href="/opportunities"
          className="text-sm rounded-md border px-3 py-1.5 hover:bg-muted transition-colors"
        >
          open RFP Lighthouse →
        </Link>
      </PageHeader>

      {revenueProgress && (
        <StrategyHero revenueProgress={revenueProgress} subscribers={socialStats?.totalSubscribers ?? 0} />
      )}

      {pendingCount > 0 && (
        <Link
          href="/inbox"
          className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm hover:bg-amber-500/15 transition-colors mb-6"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          {pendingCount} contract status {pendingCount === 1 ? "update" : "updates"} awaiting review
          <span className="ml-auto text-muted-foreground">→ inbox</span>
        </Link>
      )}

      {/* pipeline snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">active pipeline</div>
          <div className="text-2xl font-semibold mt-1">{active.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">raw value</div>
          <div className="text-2xl font-semibold mt-1">{fmtUsd(pipelineValue)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">due ≤ 30 days</div>
          <div className="text-2xl font-semibold mt-1">{deadlines.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">upgrades available</div>
          <div className="text-2xl font-semibold mt-1">{available.length}<span className="text-sm font-normal text-muted-foreground"> / {roadmap.length}</span></div>
        </div>
      </div>

      {/* by-stage strip */}
      {active.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 text-sm">
          {STAGE_ORDER.filter((s) => byStage[s]).map((s) => (
            <span key={s} className="rounded-full border px-3 py-1">
              {s} <span className="text-muted-foreground">{byStage[s]}</span>
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* bid deadlines */}
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-3">bid deadlines — next 30 days</h2>
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">nothing due in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
              {deadlines.map((o) => {
                const d = daysUntil(o.dueDate!.start);
                return (
                  <li key={o.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <Link href={`/rfp-radar/${o.id}`} className="font-medium hover:underline">{o.opportunityName}</Link>
                      <div className="text-xs text-muted-foreground">{o.status} · {o.wvFitScore}{o.estimatedValue ? ` · ${fmtUsd(o.estimatedValue)}` : ""}</div>
                    </div>
                    <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${d <= 3 ? "bg-red-100 text-red-700" : d <= 7 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                      {d <= 0 ? "today" : `${d}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* upgrades available */}
        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">upgrades available</h2>
            <span className="text-xs text-muted-foreground">{shippedCount} shipped</span>
          </div>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">all roadmap features shipped. 🎉</p>
          ) : (
            <div className="space-y-3">
              {(["P1", "P2", "P3"] as const).map((p) =>
                byPriority(p).length > 0 ? (
                  <div key={p}>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{p}</div>
                    <ul className="space-y-1">
                      {byPriority(p).map((r) => (
                        <li key={r.feature_id} className="text-sm flex gap-2">
                          <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5">{r.feature_id}</span>
                          <span>
                            {r.title}
                            {r.fixes && r.fixes !== "-" && <span className="text-muted-foreground"> — {r.fixes}</span>}
                            {r.status === "planned" && <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-600">planned</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
              <p className="text-xs text-muted-foreground pt-1">
                source: <code>docs/biz/feature-catalog.md</code> · ask Biz &ldquo;what upgrades are available?&rdquo;
              </p>
            </div>
          )}
        </section>
      </div>

      {/* recent decisions */}
      <section className="rounded-lg border p-4 mt-6">
        <h2 className="text-sm font-semibold mb-3">recent decisions</h2>
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">no BD decisions logged yet — Biz records go/no-go calls, pursuits, and outcomes as they happen.</p>
        ) : (
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="text-sm">
                <span className="text-muted-foreground">{d.created_at.slice(0, 10)}</span>
                {d.category && <span className="ml-2 text-xs rounded-full border px-2 py-0.5">{d.category}</span>}
                <span className="ml-2">{d.decision}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
