/**
 * Dashboard stats strip — async server component.
 *
 * Fetches deals, RFPs, and work items in parallel, then renders
 * four summary cards above the pipeline board on the home page.
 */

import Link from "next/link";
import { queryDeals } from "@/lib/notion/deals";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { queryWorkItems } from "@/lib/notion/work-items";

// ── helpers ──────────────────────────────────────────────────

function isOverdue(dueDate: { start: string; end: string | null } | null): boolean {
  if (!dueDate?.start) return false;
  return new Date(dueDate.start) < new Date();
}

// ── stat card ────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string;
  href: string;
  highlight?: string;
}

function StatCardView({ stat }: { stat: StatCard }) {
  return (
    <Link
      href={stat.href}
      className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors group"
    >
      <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
      <p className={`text-xl font-semibold tabular-nums ${stat.highlight ?? "text-foreground"}`}>
        {stat.value}
      </p>
    </Link>
  );
}

// ── main component ───────────────────────────────────────────

export async function DashboardStats() {
  // Fire all three queries in parallel — no waterfall
  const [dealsResult, rfpResult, workResult] = await Promise.all([
    queryDeals(),
    queryRfpOpportunities(),
    queryWorkItems(),
  ]);

  const deals = dealsResult.data;
  const rfps = rfpResult.data;
  const workItems = workResult.data;

  // ── active opportunities (deals not won/lost) ──────────────
  const activeDeals = deals.filter(
    (d) => d.stage !== "won" && d.stage !== "lost",
  );

  // ── pipeline value (sum of active deal values) ─────────────
  const pipelineValue = activeDeals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0,
  );

  // ── active RFPs (not won/lost/no-go/missed) ────────────────
  const activeRfps = rfps.filter(
    (r) =>
      r.status !== "won" &&
      r.status !== "lost" &&
      r.status !== "no-go" &&
      r.status !== "missed deadline",
  );

  // ── overdue work items ─────────────────────────────────────
  const overdueItems = workItems.filter(
    (w) =>
      w.status !== "complete" &&
      w.status !== "cancelled" &&
      isOverdue(w.dueDate),
  );

  const stats: StatCard[] = [
    {
      label: "active opportunities",
      value: String(activeDeals.length),
      href: "/deals",
    },
    {
      label: "pipeline value",
      value: pipelineValue > 0
        ? `$${(pipelineValue / 1000).toFixed(0)}k`
        : "$0",
      href: "/deals",
    },
    {
      label: "active RFPs",
      value: String(activeRfps.length),
      href: "/rfp-radar",
    },
    {
      label: "overdue items",
      value: String(overdueItems.length),
      href: "/work/studios",
      highlight:
        overdueItems.length > 0
          ? "text-destructive"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => (
        <StatCardView key={stat.label} stat={stat} />
      ))}
    </div>
  );
}
