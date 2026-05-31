/**
 * CommandTab — "is the platform healthy right now?"
 *
 * Operational view: what happened this week, how active is the platform,
 * and which apps have commerce signals. Designed for a quick weekly glance.
 */

import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { ActivityGauge } from "./dam-wam-gauge";
import { HintIcon } from "./hint-icon";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CommandMetrics } from "@/lib/neon/harbour-command";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  if (cents === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Delta({
  delta, isCurrency, label,
}: {
  delta: number;
  isCurrency?: boolean;
  label: string;
}) {
  const abs = isCurrency ? formatCurrency(Math.abs(delta)) : Math.abs(delta).toLocaleString();
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400" title={label}>
      <TrendingUp className="h-3 w-3" /> +{abs} vs prior week
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-500" title={label}>
      <TrendingDown className="h-3 w-3" /> -{abs} vs prior week
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> flat vs prior week
    </span>
  );
}

// ── metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, hint, value, delta, isCurrency, description,
}: {
  label: string;
  hint: string;
  value: string;
  delta: number;
  isCurrency?: boolean;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <HintIcon text={hint} />
      </div>
      <p className="text-3xl font-bold tabular-nums text-foreground leading-none">{value}</p>
      <div className="space-y-0.5">
        <Delta delta={delta} isCurrency={isCurrency} label="change vs last 7 days" />
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── section ───────────────────────────────────────────────────────────────────

function Section({
  title, note, hint, children,
}: {
  title: string;
  note?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-1.5 mb-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {hint && <HintIcon text={hint} />}
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

// ── main tab ──────────────────────────────────────────────────────────────────

export function CommandTab({ metrics }: { metrics: CommandMetrics }) {
  const { northStars: ns, ratios, fleet } = metrics;

  return (
    <div className="space-y-8">

      {/* ── This week ───────────────────────────────────────────────── */}
      <Section
        title="this week at a glance"
        note="past 7 days vs prior 7 days"
        hint="Harbour tracks two health signals side-by-side: revenue (are people buying packs?) and player activity (are people actually playing games?). Both matter — a platform can have revenue but no engagement, or engagement but no monetisation."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="revenue"
            hint="Total from completed pack purchases in the past 7 days. This is the 'Transaction' health signal — are users finding enough value to pay for premium content?"
            value={formatCurrency(ns.weeklyRevenueCents)}
            delta={ns.weeklyRevenueDeltaCents}
            isCurrency
            description="completed pack purchases"
          />
          <MetricCard
            label="active players"
            hint="Users who logged activity in any harbour game in the past 7 days. This is the 'Attention' health signal — regardless of purchases, are users actually showing up?"
            value={ns.weeklyActiveUsers.toLocaleString()}
            delta={ns.weeklyActiveUsersDelta}
            description="active in any harbour game"
          />
          <MetricCard
            label="codes redeemed"
            hint="Number of access code redemptions in the past 7 days across all campaigns. A spike here often follows a workshop or event where codes were distributed."
            value={metrics.codeRedemptionsThisWeek.toLocaleString()}
            delta={0}
            description={`${metrics.activeCampaignCodes} active campaign code${metrics.activeCampaignCodes !== 1 ? "s" : ""}`}
          />
        </div>
      </Section>

      {/* ── Platform activity ───────────────────────────────────────── */}
      <Section
        title="how active is the platform?"
        hint="These gauges show what fraction of all registered users showed up in a given time window. The benchmark rings are based on Mighty Networks research: healthy community platforms typically see 20% of members show up daily and 50% weekly."
      >
        <div className="flex flex-wrap gap-8 items-start pl-2">
          <ActivityGauge
            value={ratios.damRatio}
            target={0.20}
            label="active today"
            description="Percentage of all registered users who were active today. Aim for 20%+ — the benchmark for healthy daily-habit platforms."
            count={ratios.dailyActiveUsers}
            total={ratios.totalUsers}
          />
          <ActivityGauge
            value={ratios.wamRatio}
            target={0.50}
            label="active this week"
            description="Percentage of all registered users who were active in the past 7 days. Aim for 50%+ — anything below means most users aren't forming a weekly habit."
            count={ratios.weeklyActiveUsers}
            total={ratios.totalUsers}
          />
          <div className="text-xs text-muted-foreground space-y-1.5 max-w-xs pt-1">
            <p>
              <span className="font-medium text-foreground">{ratios.totalUsers.toLocaleString()}</span>
              {" "}total registered users
            </p>
            <p>
              <span className="font-medium text-green-600 dark:text-green-400">{ratios.dailyActiveUsers.toLocaleString()}</span>
              {" "}active today
            </p>
            <p>
              <span className="font-medium text-blue-600 dark:text-blue-400">{ratios.weeklyActiveUsers.toLocaleString()}</span>
              {" "}active this week
            </p>
            <p>
              <span className="font-medium">{ratios.monthlyActiveUsers.toLocaleString()}</span>
              {" "}active this month
            </p>
            <p className="text-[10px] opacity-60 pt-1 leading-relaxed">
              tick marks on the rings show the benchmark targets.
              green = at or above target · amber = close · red = needs attention.
            </p>
          </div>
        </div>
      </Section>

      {/* ── App fleet ───────────────────────────────────────────────── */}
      <Section
        title="apps with commerce activity"
        note="apps that have had purchases or active pack access"
        hint="This table shows harbour apps that have real transaction data — pack purchases or active entitlements (unlocked content access). Apps not shown here have no commerce data yet. Session-level signals (who's playing what, how long) arrive in Phase 2."
      >
        {fleet.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            no per-app data yet — appears once users start buying or unlocking packs.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>app</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        access granted
                        <HintIcon text="Users with an active entitlement — meaning they've been given access to a paid pack in this app, either through purchase or as a gift." />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">revenue this week</TableHead>
                    <TableHead className="text-right">revenue this month</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        purchases this week
                        <HintIcon text="Number of completed pack purchases in the past 7 days for this app." />
                      </div>
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground/70">all-time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fleet.map((row) => (
                    <TableRow key={row.app}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{row.app}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.activeEntitlements > 0
                          ? row.activeEntitlements.toLocaleString()
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {row.revenueThisWeekCents > 0
                          ? formatCurrency(row.revenueThisWeekCents)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.revenueThisMonthCents > 0
                          ? formatCurrency(row.revenueThisMonthCents)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.purchasesThisWeek > 0
                          ? row.purchasesThisWeek
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.totalPurchases > 0 ? row.totalPurchases : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[10px] text-muted-foreground pl-1">
              "access granted" = active pack entitlements (paid or gifted access to premium content in this app).
            </p>
          </div>
        )}
      </Section>

      {/* ── Phase 2 ─────────────────────────────────────────────────── */}
      <Section
        title="session-level signals"
        note="coming in phase 2"
        hint="Phase 2 adds the Analytics Engine layer: each harbour game's CF Worker will emit a data point per visitor, enabling per-game session counts, time-on-page, D1/D7/D30 retention rates, and traffic source breakdowns."
      >
        <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          <Activity className="h-5 w-5 mx-auto mb-2 opacity-40" />
          <p>who's playing what · how long they stay · day-1 / day-7 / day-30 return rates</p>
          <p className="text-xs mt-1.5 opacity-70">
            requires adding an Analytics Engine binding to each of the ~18 CF Worker games
          </p>
        </div>
      </Section>

    </div>
  );
}
