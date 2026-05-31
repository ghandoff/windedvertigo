/**
 * ObservatoryTab — analytical harbour growth view.
 *
 * "What's growing, what's dying, and why?"
 *
 * Sections:
 *  1. User state flow (Duolingo 6-bucket model)
 *  2. Knots activity sparkline (30 days)
 *  3. User growth bar chart (12 months)
 *  4. Pack discovery funnel
 *  5. Revenue cohort grid
 *  6. Player leaderboard (top 20)
 *  7. depth.chart usage
 *  8. Phase 2 placeholder (D1/D7/D30)
 */

import { BarChart2 } from "lucide-react";
import { UserStateFlow }    from "./user-state-flow";
import { KnotsSparkline }   from "./knots-sparkline";
import { BarChart }         from "./bar-chart";
import { FunnelChart }      from "./funnel-chart";
import { RevenueCohort }    from "./revenue-cohort";
import { PlayerLeaderboard } from "./player-leaderboard";
import type { HarbourAnalytics } from "@/lib/neon/harbour-analytics";
import type { ObservatoryMetrics } from "@/lib/neon/harbour-observatory";

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

interface Props {
  analytics: HarbourAnalytics;
  observatory: ObservatoryMetrics;
  app?: string;
}

export function ObservatoryTab({ analytics, observatory, app }: Props) {
  const { userGrowth, depthChart } = analytics;
  const {
    userStateBuckets, knotsActivity30d, packFunnel,
    revenueCohorts, playerLeaderboard,
  } = observatory;

  // Build pack discovery funnel steps from observatory data
  const packDiscoverySteps = [
    { label: "signed up",           count: packFunnel.totalUsers },
    { label: "has entitlement",     count: packFunnel.withEntitlement },
    { label: "paid entitlement",    count: packFunnel.withPaidEntitlement },
    { label: "active post-purchase", count: packFunnel.activePostPurchase },
  ];

  return (
    <div className="space-y-10">

      {/* ── 1. User state buckets ────────────────────────────────────── */}
      <Section title="user state flow" note="6-bucket model — always harbour-wide">
        <UserStateFlow buckets={userStateBuckets} />
      </Section>

      {/* ── 2. Knots sparkline ───────────────────────────────────────── */}
      <Section title="knots activity" note="past 30 days — always harbour-wide">
        <div className="rounded-lg border border-border bg-card p-4">
          <KnotsSparkline
            data={knotsActivity30d}
            totalEarned={analytics.knots.totalEarned}
            totalSpent={analytics.knots.totalSpent}
          />
        </div>
        {/* Breakdown by reason */}
        {analytics.knots.byReason.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {analytics.knots.byReason.slice(0, 4).map((r) => (
              <div key={r.reason} className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground truncate">{r.reason}</p>
                <p className="text-lg font-semibold tabular-nums">{r.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── 3. User growth ───────────────────────────────────────── */}
        <Section title="user growth" note="last 12 months — harbour-wide">
          <div className="rounded-lg border border-border bg-card p-4">
            <BarChart data={userGrowth} />
            <p className="text-xs text-muted-foreground mt-2">
              bars = monthly signups · line = cumulative
            </p>
          </div>
        </Section>

        {/* ── 4. Pack discovery funnel ─────────────────────────────── */}
        <Section
          title="pack discovery funnel"
          note={app ? `scoped to ${app}` : "harbour-wide"}
        >
          <div className="rounded-lg border border-border bg-card p-4">
            <FunnelChart steps={packDiscoverySteps} />
            <p className="text-xs text-muted-foreground mt-3">
              active post-purchase = last_active_at ≥ purchase date (proxy activation)
            </p>
          </div>
        </Section>
      </div>

      {/* ── 5. Revenue cohort grid ───────────────────────────────────── */}
      <Section
        title="revenue cohorts"
        note="% of signup cohort who purchased by month N — last 6 cohorts"
      >
        <RevenueCohort cohorts={revenueCohorts} />
      </Section>

      {/* ── 6. Player leaderboard ────────────────────────────────────── */}
      <Section title="engagement leaderboard" note="top 20 by knots — harbour-wide">
        <PlayerLeaderboard players={playerLeaderboard} />
      </Section>

      {/* ── 7. depth.chart telemetry ─────────────────────────────────── */}
      {(!app || app === "depth-chart") && (
        <Section title="depth.chart usage" note="assessment generator telemetry">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "plans created",    value: depthChart.plansCreated },
              { label: "tasks generated",  value: depthChart.tasksGenerated },
              { label: "total events",     value: depthChart.totalEvents },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold tabular-nums">{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 8. Phase 2 placeholder ───────────────────────────────────── */}
      <Section title="game-level analytics" note="phase 2 — requires L1 analytics engine">
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          <BarChart2 className="h-5 w-5 mx-auto mb-2 opacity-40" />
          <p>D1 / D7 / D30 retention per game · per-game activation funnel · session depth histogram</p>
          <p className="text-xs mt-1">
            phase 2: add <code className="font-mono">HARBOUR_ANALYTICS</code> Analytics Engine binding
            to each harbour CF Worker → redeploy ~18 workers.
          </p>
        </div>
      </Section>

    </div>
  );
}
