/**
 * CommandTab — operational harbour fleet view.
 *
 * "Is everything alive and healthy right now?"
 *
 * Sections:
 *  1. Dual North Star strip (Transaction + Attention)
 *  2. DAM/WAM ring gauges with benchmark rings
 *  3. Per-app fleet table (apps with L2 commerce data)
 *  4. Phase 2 placeholder for L1 session signals
 */

import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { RingGauge } from "./dam-wam-gauge";
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

function DeltaBadge({ delta, isCurrency }: { delta: number; isCurrency?: boolean }) {
  const label = isCurrency ? formatCurrency(Math.abs(delta)) : Math.abs(delta).toLocaleString();
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
      <TrendingUp className="h-3 w-3" />+{label}
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
      <TrendingDown className="h-3 w-3" />-{label}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" />flat
    </span>
  );
}

// ── north star card ───────────────────────────────────────────────────────────

function NorthStarCard({
  label,
  value,
  delta,
  isCurrency,
  sublabel,
}: {
  label: string;
  value: string;
  delta: number;
  isCurrency?: boolean;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-foreground leading-none">{value}</p>
      <div className="flex items-center gap-2">
        <DeltaBadge delta={delta} isCurrency={isCurrency} />
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      </div>
    </div>
  );
}

// ── section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
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

      {/* ── North Stars ─────────────────────────────────────────────── */}
      <Section title="north stars" note="transaction + attention — this week vs prior week">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NorthStarCard
            label="⚡ transaction — weekly revenue"
            value={formatCurrency(ns.weeklyRevenueCents)}
            delta={ns.weeklyRevenueDeltaCents}
            isCurrency
            sublabel="vs prior 7 days"
          />
          <NorthStarCard
            label="👁 attention — weekly active users"
            value={ns.weeklyActiveUsers.toLocaleString()}
            delta={ns.weeklyActiveUsersDelta}
            sublabel="vs prior 7 days"
          />
        </div>
      </Section>

      {/* ── DAM/WAM gauges ──────────────────────────────────────────── */}
      <Section
        title="activity ratios"
        note={`${ratios.monthlyActiveUsers.toLocaleString()} monthly active base · benchmarks: DAM ≥ 20% · WAM ≥ 50%`}
      >
        <div className="flex flex-wrap gap-8 items-center pl-2">
          <RingGauge
            value={ratios.damRatio}
            target={0.20}
            label="DAM / MAM"
            count={ratios.dailyActiveUsers}
          />
          <RingGauge
            value={ratios.wamRatio}
            target={0.50}
            label="WAM / MAM"
            count={ratios.weeklyActiveUsers}
          />
          <div className="text-xs text-muted-foreground space-y-1 max-w-xs">
            <p><span className="font-medium text-foreground">{ratios.totalUsers.toLocaleString()}</span> total registered users</p>
            <p><span className="font-medium text-green-600 dark:text-green-400">{ratios.dailyActiveUsers.toLocaleString()}</span> active today (DAM)</p>
            <p><span className="font-medium text-blue-600 dark:text-blue-400">{ratios.weeklyActiveUsers.toLocaleString()}</span> active this week (WAM)</p>
            <p><span className="font-medium">{ratios.monthlyActiveUsers.toLocaleString()}</span> active this month (MAM)</p>
            <p className="text-[10px] opacity-70 pt-1">
              benchmarks from Mighty Networks research (20% DAM, 50% WAM).
              tick marks show target positions on the ring.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Fleet table ─────────────────────────────────────────────── */}
      <Section
        title="app fleet"
        note="apps with active L2 data — session signals arrive in phase 2"
      >
        {fleet.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            no per-app commerce data yet. fleet signals appear once packs are purchased.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>app</TableHead>
                  <TableHead className="text-right">entitlements</TableHead>
                  <TableHead className="text-right">revenue 7d</TableHead>
                  <TableHead className="text-right">revenue 30d</TableHead>
                  <TableHead className="text-right">purchases 7d</TableHead>
                  <TableHead className="text-right">all-time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fleet.map((row) => (
                  <TableRow key={row.app}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.app}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.activeEntitlements.toLocaleString()}
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
                      {row.totalPurchases}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── Phase 2 placeholder ─────────────────────────────────────── */}
      <Section title="session signals" note="phase 2 — requires L1 analytics engine">
        <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          <Activity className="h-5 w-5 mx-auto mb-2 opacity-40" />
          <p>sessions today · D7 retention · time-on-app · traffic per game</p>
          <p className="text-xs mt-1">
            phase 2: add <code className="font-mono">HARBOUR_ANALYTICS</code> Analytics Engine binding
            to each harbour CF Worker → redeploy ~18 workers.
          </p>
        </div>
      </Section>

    </div>
  );
}
