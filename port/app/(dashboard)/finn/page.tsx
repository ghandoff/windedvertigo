/**
 * /finances — Fin's CFO dashboard.
 * Owner-only: redirects non-garrett users to /dashboard.
 * Reads from the latest fin_snapshots + open fin_items + fin_patterns.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DollarSign } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/app/components/page-header";
import {
  getLatestSnapshots,
  getOpenFinItems,
  getUpcomingFinItems,
  getUpcomingDeadlines,
  getRecentDecisions,
} from "@/lib/fin-data";
import { FinItemRow } from "./components/fin-item-row";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "garrett@windedvertigo.com";

function fmtUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function safeNum(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = parseFloat(val); return isNaN(n) ? null : n; }
  return null;
}

export default async function FinancesPage() {
  const session = await auth();
  if (session?.user?.email !== OWNER_EMAIL) redirect("/dashboard");

  const [snapshots, openItems, upcomingItems, upcomingDeadlines, recentDecisions] =
    await Promise.all([
      getLatestSnapshots().catch((): Partial<Record<import("@/lib/fin-data").FinSnapshotType, import("@/lib/fin-data").FinSnapshot>> => ({})),
      getOpenFinItems().catch(() => []),
      getUpcomingFinItems(30).catch(() => []),
      getUpcomingDeadlines(30).catch(() => []),
      getRecentDecisions(10).catch(() => []),
    ]);

  const bs = snapshots.balance_sheet;
  const pl = snapshots.p_and_l;
  const ap = snapshots.ap_aging;
  const ar = snapshots.ar_aging;
  const payroll = snapshots.payroll;

  const lastFetchedAt =
    Object.values(snapshots)
      .map((s) => s?.fetched_at ?? "")
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  // merge upcoming items + upcoming patterns, sort by date
  const upcomingRows: Array<{ date: string | null; label: string; sublabel?: string; amount_cents?: number | null }> = [
    ...upcomingItems.map((i) => ({
      date: i.due_date,
      label: i.title,
      sublabel: i.type.replace(/_/g, " "),
      amount_cents: i.amount_cents,
    })),
    ...upcomingDeadlines.map((p) => ({
      date: p.next_expected,
      label: `${p.vendor} — ${p.description}`,
      sublabel: p.typical_cycle,
      amount_cents: p.typical_amount_cents,
    })),
  ].sort((a, b) => (a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1);

  const today = new Date().toISOString().slice(0, 10);
  const pendingItems = openItems.filter((i) => i.status === "pending" || (i.status === "snoozed" && (!i.snooze_until || i.snooze_until <= today)));

  return (
    <>
      <PageHeader
        title="finn"
        description={`Fin · CFO agent · winded.vertigo LLC + garrett personal`}
      >
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </PageHeader>

      {/* refresh banner */}
      <div className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          last updated{" "}
          <span className="font-medium text-foreground">{relTime(lastFetchedAt)}</span>
          {lastFetchedAt && (
            <span className="ml-1">({lastFetchedAt.slice(0, 16)} UTC)</span>
          )}
        </span>
        <span className="text-[11px]">run <code className="font-mono">fin_briefing</code> in cowork to refresh</span>
      </div>

      <div className="space-y-4">
        {/* ── row 1: cash + P&L ───────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* cash position */}
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">cash balance</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {fmtUsd(safeNum((bs?.data as Record<string, unknown>)?.cash_cents))}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">from balance sheet snapshot</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">total assets</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {fmtUsd(safeNum((bs?.data as Record<string, unknown>)?.total_assets_cents))}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">liabilities: {fmtUsd(safeNum((bs?.data as Record<string, unknown>)?.total_liabilities_cents))}</p>
          </div>
          {/* month P&L */}
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              revenue — {(pl?.period_label) ?? "current month"}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {fmtUsd(safeNum((pl?.data as Record<string, unknown>)?.revenue_cents))}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              expenses: {fmtUsd(safeNum((pl?.data as Record<string, unknown>)?.expenses_cents))}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">net — {(pl?.period_label) ?? "current month"}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${safeNum((pl?.data as Record<string, unknown>)?.net_cents) != null && safeNum((pl?.data as Record<string, unknown>)?.net_cents)! >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {fmtUsd(safeNum((pl?.data as Record<string, unknown>)?.net_cents))}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              YTD net: {fmtUsd(safeNum((pl?.data as Record<string, unknown>)?.ytd_net_cents))}
            </p>
          </div>
        </div>

        {/* ── row 2: AP / AR / payroll ────────────────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-3">
          {/* accounts payable */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">accounts payable</h2>
            </div>
            <div className="divide-y divide-border">
              {!ap ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">no snapshot — run fin_briefing</p>
              ) : (
                (() => {
                  const vendors = (ap.data as Record<string, unknown>)?.vendors as Array<{ name: string; total_cents: number; overdue_cents?: number }> | undefined;
                  if (!vendors?.length) return <p className="px-4 py-4 text-sm text-muted-foreground">no outstanding bills</p>;
                  return vendors.slice(0, 8).map((v, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
                      <span className="flex-1 truncate">{v.name}</span>
                      <span className={`tabular-nums text-xs font-medium ${v.overdue_cents && v.overdue_cents > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                        {fmtUsd(v.total_cents)}
                      </span>
                      {v.overdue_cents && v.overdue_cents > 0 && (
                        <span className="text-[10px] text-red-600 dark:text-red-400">overdue</span>
                      )}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>

          {/* accounts receivable */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">accounts receivable</h2>
            </div>
            <div className="divide-y divide-border">
              {!ar ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">no snapshot — run fin_briefing</p>
              ) : (
                (() => {
                  const customers = (ar.data as Record<string, unknown>)?.customers as Array<{ name: string; total_cents: number; over_30_cents?: number }> | undefined;
                  if (!customers?.length) return <p className="px-4 py-4 text-sm text-muted-foreground">no outstanding invoices</p>;
                  return customers.slice(0, 8).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className={`tabular-nums text-xs font-medium ${c.over_30_cents && c.over_30_cents > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                        {fmtUsd(c.total_cents)}
                      </span>
                      {c.over_30_cents && c.over_30_cents > 0 && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">&gt;30d</span>
                      )}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>

          {/* payroll */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">payroll</h2>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              {!payroll ? (
                <p className="text-muted-foreground">no snapshot — run fin_briefing</p>
              ) : (
                (() => {
                  const pd = payroll.data as Record<string, unknown>;
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">last check date</span>
                        <span>{String(pd?.check_date ?? "—")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">pay period</span>
                        <span className="text-xs">{pd?.pay_period_start && pd?.pay_period_end ? `${String(pd.pay_period_start).slice(5)} – ${String(pd.pay_period_end).slice(5)}` : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">gross pay</span>
                        <span className="tabular-nums">{fmtUsd(safeNum(pd?.gross_pay_cents))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">net pay</span>
                        <span className="tabular-nums">{fmtUsd(safeNum(pd?.net_pay_cents))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">company debit</span>
                        <span className="tabular-nums font-medium">{fmtUsd(safeNum(pd?.company_debit_cents))}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border mt-1">
                        <span className="text-muted-foreground">next scheduled</span>
                        <span>{String(pd?.next_pay_date ?? "—")}</span>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* ── row 3: action required + upcoming + decisions ────────────── */}
        <div className="grid gap-3 lg:grid-cols-3">
          {/* action required */}
          <div className="rounded-lg border border-border bg-card lg:col-span-2">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">action required</h2>
              {pendingItems.length > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  {pendingItems.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-border">
              {pendingItems.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">nothing pending — all clear</p>
              )}
              {pendingItems.map((item) => (
                <FinItemRow key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* recent decisions */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">recent decisions</h2>
            </div>
            <div className="divide-y divide-border">
              {recentDecisions.length === 0 && (
                <p className="px-4 py-4 text-sm text-muted-foreground">none logged yet</p>
              )}
              {recentDecisions.slice(0, 10).map((d) => (
                <div key={d.id} className="px-4 py-2">
                  <p className="text-[11px] text-muted-foreground">{d.created_at.slice(0, 10)}{d.category ? ` · ${d.category}` : ""}</p>
                  <p className="mt-0.5 text-xs line-clamp-2">{d.decision}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── upcoming 30 days ─────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">upcoming 30 days</h2>
          </div>
          <div className="divide-y divide-border">
            {upcomingRows.length === 0 && (
              <p className="px-4 py-4 text-sm text-muted-foreground">nothing scheduled in the next 30 days</p>
            )}
            {upcomingRows.map((row, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-xs text-muted-foreground">{row.date ?? "—"}</span>
                <span className="flex-1 truncate">{row.label}</span>
                {row.sublabel && (
                  <span className="text-[11px] text-muted-foreground shrink-0">{row.sublabel}</span>
                )}
                {row.amount_cents != null && (
                  <span className="tabular-nums text-xs font-medium shrink-0">{fmtUsd(row.amount_cents)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
