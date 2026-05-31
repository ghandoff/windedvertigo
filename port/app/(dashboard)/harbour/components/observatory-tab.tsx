/**
 * ObservatoryTab — "what's growing, what's dying, and why?"
 *
 * Analytical view: user lifecycle stages, engagement trends, commerce
 * funnels, and cohort patterns. Designed for a weekly strategy review.
 */

import { BarChart2 } from "lucide-react";
import { UserStateFlow }    from "./user-state-flow";
import { KnotsSparkline }   from "./knots-sparkline";
import { BarChart }         from "./bar-chart";
import { FunnelChart }      from "./funnel-chart";
import { RevenueCohort }    from "./revenue-cohort";
import { PlayerLeaderboard } from "./player-leaderboard";
import { HintIcon }         from "./hint-icon";
import { CampaignCodes }    from "./campaign-codes";
import type { HarbourAnalytics } from "@/lib/neon/harbour-analytics";
import type { ObservatoryMetrics } from "@/lib/neon/harbour-observatory";

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

interface Props {
  analytics: HarbourAnalytics;
  observatory: ObservatoryMetrics;
  app?: string;
}

export function ObservatoryTab({ analytics, observatory, app }: Props) {
  const { userGrowth, depthChart, knots } = analytics;
  const {
    userStateBuckets, knotsActivity30d, packFunnel,
    revenueCohorts, playerLeaderboard, accessCodes,
  } = observatory;

  // Pack funnel steps in plain English
  const packDiscoverySteps = [
    { label: "registered users",       count: packFunnel.totalUsers },
    { label: "has content unlocked",   count: packFunnel.withEntitlement },
    { label: "bought a pack",          count: packFunnel.withPaidEntitlement },
    { label: "still active after buying", count: packFunnel.activePostPurchase },
  ];

  return (
    <div className="space-y-10">

      {/* ── 1. User lifecycle ──────────────────────────────────────── */}
      <Section
        title="where are your players right now?"
        hint="Segments all registered users into six states based on when they were last active. The goal is to understand the health of the whole player base at a glance — not just total counts, but who's engaged, who's drifting, and who's been lost."
      >
        <UserStateFlow buckets={userStateBuckets} />
      </Section>

      {/* ── 2. Engagement currency ─────────────────────────────────── */}
      <Section
        title="engagement activity — past 30 days"
        hint="Knots are the platform's engagement points — players earn them by completing activities across harbour games (finishing a session, referring a friend, completing their profile). The sparkline shows daily earned vs spent over the past month."
      >
        <div className="rounded-lg border border-border bg-card p-4">
          <KnotsSparkline
            data={knotsActivity30d}
            totalEarned={knots.totalEarned}
            totalSpent={knots.totalSpent}
          />
        </div>
        {knots.byReason.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {knots.byReason.slice(0, 4).map((r) => (
              <div key={r.reason} className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground truncate capitalize">
                  {r.reason.replace(/_/g, " ")}
                </p>
                <p className="text-lg font-semibold tabular-nums">{r.amount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">knots total</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── 3. Growth ──────────────────────────────────────────── */}
        <Section
          title="user growth"
          note="last 12 months"
          hint="Monthly new signups (bars) and the running total of all registered users (line). This is a lagging indicator — new signups don't mean active players."
        >
          <div className="rounded-lg border border-border bg-card p-4">
            <BarChart data={userGrowth} />
            <p className="text-xs text-muted-foreground mt-2">
              bars = new signups that month · line = all-time total
            </p>
          </div>
        </Section>

        {/* ── 4. Purchase funnel ─────────────────────────────────── */}
        <Section
          title="how users find and buy packs"
          note={app ? `filtered to ${app}` : "all apps"}
          hint={`Packs are bundles of premium content${app ? ` within ${app}` : " across harbour apps"} — unlocked by purchase or gifted as entitlements. This funnel shows where users drop off: signing up but never unlocking content, or unlocking but not staying active.`}
        >
          <div className="rounded-lg border border-border bg-card p-4">
            <FunnelChart steps={packDiscoverySteps} />
            <p className="text-xs text-muted-foreground mt-3">
              "still active after buying" = last active date is on or after purchase date
            </p>
          </div>
        </Section>
      </div>

      {/* ── 5. Revenue cohorts ──────────────────────────────────── */}
      <Section
        title="when do users make their first purchase?"
        hint="Groups users by the month they signed up (a 'cohort') and shows what percentage of each group eventually bought a pack. Useful for spotting whether new users convert faster or slower than older cohorts — and whether anything changed month-to-month."
      >
        <RevenueCohort cohorts={revenueCohorts} />
      </Section>

      {/* ── 6. Leaderboard ─────────────────────────────────────── */}
      <Section
        title="most engaged players"
        note="ranked by total knots — platform-wide"
        hint="The top 20 players by total knots earned. Knots are harbour-wide (not per-game) so this always shows the platform's most engaged users regardless of which app filter is active. These are your power users — their feedback and retention matter most."
      >
        <PlayerLeaderboard players={playerLeaderboard} />
      </Section>

      {/* ── 7. depth.chart telemetry ────────────────────────────── */}
      {(!app || app === "depth-chart") && (
        <Section
          title="depth.chart — assessment generator"
          note="the one harbour app with detailed Neon-level telemetry today"
          hint="depth.chart generates assessment tasks from curriculum plans using AI. Because it uses Neon directly (unlike most harbour games which are stateless CF Workers), it has the richest usage data available today."
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "curriculum plans created",
                sub: "teachers uploaded a plan",
                value: depthChart.plansCreated,
              },
              {
                label: "assessment tasks generated",
                sub: "AI-generated tasks across all plans",
                value: depthChart.tasksGenerated,
              },
              {
                label: "total usage events",
                sub: "all tracked interactions",
                value: depthChart.totalEvents,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                <p className="text-xl font-semibold tabular-nums mt-1">{s.value.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 8. Access code campaigns ────────────────────────────── */}
      <Section
        title="who's using your access codes?"
        hint="Tracks redemption of campaign codes (like PRME2026). Shows per-campaign counts, daily redemption activity, and whether users who redeemed a code actually came back — the activation rate."
      >
        <CampaignCodes metrics={accessCodes} />
      </Section>

      {/* ── 9. Phase 2 ─────────────────────────────────────────── */}
      <Section
        title="per-game retention analytics"
        note="coming in phase 2"
        hint="Phase 2 adds visitor-level web analytics via Cloudflare Analytics Engine. Each game's CF Worker will emit an event per request, enabling day-1 / day-7 / day-30 return rates, session depth histograms, and per-game activation funnels."
      >
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          <BarChart2 className="h-5 w-5 mx-auto mb-2 opacity-40" />
          <p className="font-medium">did players come back? — day 1, day 7, day 30 return rates per game</p>
          <p className="text-xs mt-1.5 leading-relaxed opacity-70">
            also: session depth (how long do people play before leaving?),
            and activation rates (what action predicts a player returning?)
          </p>
        </div>
      </Section>

    </div>
  );
}
