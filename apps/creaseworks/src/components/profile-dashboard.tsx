/**
 * Profile Dashboard — the main dashboard component for the profile page.
 *
 * Displays:
 * - Stats row: total runs, playdates tried, evidence captured, current streak
 * - Badge progress: visual representation of badge tier progression
 * - Recent activity: last 5 runs with badges achieved
 * - Favorite collection: callout showing most-engaged collection
 *
 * This is a server component that receives pre-computed stats.
 */

import Link from "next/link";
import type { ProfileStats } from "@/lib/queries/profile-stats";

interface ProfileDashboardProps {
  stats: ProfileStats;
}

/**
 * Badge tier display info
 */
const BADGE_TIERS = [
  {
    key: "tried_it",
    label: "Tried It",
    emoji: "🎯",
    description: "Tried a playdate",
  },
  {
    key: "found_something",
    label: "Found Something",
    emoji: "🔍",
    description: "Discovered something new",
  },
  {
    key: "folded_unfolded",
    label: "Folded & Unfolded",
    emoji: "🎨",
    description: "Created and changed",
  },
  {
    key: "found_again",
    label: "Found Again",
    emoji: "✨",
    description: "Rediscovered the magic",
  },
];

export default function ProfileDashboard({ stats }: ProfileDashboardProps) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold tracking-tight mb-5">your dashboard</h2>

      {/* ---- stats row: 4 cards ---- */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 mb-8">
        <StatCard
          label="Total Runs"
          value={stats.totalRuns}
          accent="cadet"
          icon="▶️"
        />
        <StatCard
          label="Playdates Tried"
          value={stats.totalPlaydatesTried}
          accent="sienna"
          icon="🎮"
        />
        <StatCard
          label="Evidence Captured"
          value={stats.totalEvidence}
          accent="champagne"
          icon="📸"
        />
        <StatCard
          label="Current Streak"
          value={stats.currentStreak}
          accent="redwood"
          icon="🔥"
        />
      </div>

      {/* ---- badge progress section ---- */}
      <div className="mb-8 rounded-xl border border-cadet/10 px-5 py-5">
        <h3
          className="text-sm font-semibold tracking-tight mb-4"
          style={{ color: "var(--wv-cadet)" }}
        >
          badge journey
        </h3>
        <div className="space-y-3">
          {BADGE_TIERS.map((tier) => {
            const count = stats.badgeCounts[tier.key as keyof typeof stats.badgeCounts];
            return (
              <div key={tier.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tier.emoji}</span>
                    <div>
                      <div
                        className="text-sm font-medium"
                        style={{ color: "var(--wv-cadet)" }}
                      >
                        {tier.label}
                      </div>
                      <div className="text-xs text-cadet/40">{tier.description}</div>
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold"
                    style={{
                      color:
                        count > 0
                          ? tier.key === "tried_it"
                            ? "var(--wv-cadet)"
                            : tier.key === "found_something"
                              ? "var(--wv-sienna)"
                              : tier.key === "folded_unfolded"
                                ? "var(--wv-champagne)"
                                : "var(--wv-redwood)"
                          : "var(--wv-cadet)",
                      opacity: count > 0 ? 1 : 0.3,
                    }}
                  >
                    {count}
                  </div>
                </div>
                {/* Simple progress indicator */}
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{
                    backgroundColor:
                      tier.key === "tried_it"
                        ? "rgba(39, 50, 72, 0.08)"
                        : tier.key === "found_something"
                          ? "rgba(203, 120, 88, 0.08)"
                          : tier.key === "folded_unfolded"
                            ? "rgba(232, 217, 188, 0.2)"
                            : "rgba(177, 80, 67, 0.08)",
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: count > 0 ? "100%" : "0%",
                      backgroundColor:
                        tier.key === "tried_it"
                          ? "var(--wv-cadet)"
                          : tier.key === "found_something"
                            ? "var(--wv-sienna)"
                            : tier.key === "folded_unfolded"
                              ? "var(--wv-champagne)"
                              : "var(--wv-redwood)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- recent activity feed ---- */}
      {stats.recentActivity.length > 0 && (
        <div className="mb-8 rounded-xl border border-cadet/10 px-5 py-5">
          <h3
            className="text-sm font-semibold tracking-tight mb-3"
            style={{ color: "var(--wv-cadet)" }}
          >
            recent activity
          </h3>
          <div className="space-y-2">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between text-sm rounded-lg border border-cadet/5 px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-cadet font-medium truncate">
                    {activity.playdate_title || activity.title}
                  </div>
                  {activity.badge_earned && (
                    <div className="text-xs text-cadet/40 mt-0.5">
                      {activity.badge_earned === "tried_it"
                        ? "🎯 Tried it"
                        : activity.badge_earned === "found_something"
                          ? "🔍 Found something"
                          : activity.badge_earned === "folded_unfolded"
                            ? "🎨 Folded & unfolded"
                            : "✨ Found again"}
                    </div>
                  )}
                </div>
                {activity.run_date && (
                  <span className="text-cadet/35 text-xs whitespace-nowrap ml-2">
                    {new Date(activity.run_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/playbook"
            className="text-xs text-sienna/70 hover:text-sienna transition-colors inline-block mt-2"
          >
            see all in playbook &rarr;
          </Link>
        </div>
      )}

      {/* ---- favorite collection callout ---- */}
      {stats.favoriteCollection && (
        <div
          className="rounded-xl border px-5 py-4"
          style={{
            borderColor: "rgba(203, 120, 88, 0.2)",
            backgroundColor: "rgba(203, 120, 88, 0.03)",
          }}
        >
          <div className="flex items-start gap-3">
            {stats.favoriteCollection.icon_emoji && (
              <span className="text-2xl flex-shrink-0">
                {stats.favoriteCollection.icon_emoji}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold mb-0.5">
                <span style={{ color: "var(--wv-sienna)" }}>
                  {stats.favoriteCollection.title}
                </span>
                <span className="text-cadet/40 font-normal ml-2">
                  ({stats.favoriteCollection.run_count}{" "}
                  {stats.favoriteCollection.run_count === 1 ? "run" : "runs"})
                </span>
              </h4>
              <p className="text-xs text-cadet/50">
                your most-engaged collection. keep exploring!
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Single stat card component
 */
function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: "cadet" | "sienna" | "champagne" | "redwood";
  icon: string;
}) {
  const colors = {
    cadet: { bg: "rgba(39, 50, 72, 0.04)", text: "var(--wv-cadet)" },
    sienna: { bg: "rgba(203, 120, 88, 0.08)", text: "var(--wv-sienna)" },
    champagne: { bg: "rgba(232, 217, 188, 0.12)", text: "var(--wv-champagne)" },
    redwood: { bg: "rgba(177, 80, 67, 0.08)", text: "var(--wv-redwood)" },
  };

  const color = colors[accent];

  return (
    <div
      className="rounded-lg border p-4 text-center"
      style={{
        backgroundColor: color.bg,
        borderColor: `${color.text}20`,
      }}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div
        className="text-2xl sm:text-3xl font-bold mb-1"
        style={{ color: color.text }}
      >
        {value}
      </div>
      <div className="text-xs text-cadet/40">{label}</div>
    </div>
  );
}
