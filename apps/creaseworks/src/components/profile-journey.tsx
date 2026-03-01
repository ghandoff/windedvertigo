/**
 * Profile "your journey" — milestone path + pack progress + credit balance.
 *
 * Replaces the generic subscription tier cards with a personal
 * progression narrative synthesised from play data. Server component.
 */

import Link from "next/link";
import type { BadgeCounts } from "@/lib/queries/profile-stats";
import { REDEMPTION_THRESHOLDS } from "@/lib/queries/credits";

/* ── types ─────────────────────────────────────────────────────────── */

interface OwnedPack {
  id: string;
  slug: string;
  title: string;
  playdate_count: number;
  tried_count: number;
  found_count: number;
  folded_count: number;
  found_again_count: number;
}

interface ProfileJourneyProps {
  totalRuns: number;
  totalEvidence: number;
  longestStreak: number;
  badgeCounts: BadgeCounts;
  ownedPacks: OwnedPack[];
  creditBalance: number;
}

/* ── milestones ────────────────────────────────────────────────────── */

interface Milestone {
  key: string;
  emoji: string;
  label: string;
  detail: string;
  /** returns true when the milestone is achieved */
  test: (p: ProfileJourneyProps) => boolean;
}

const MILESTONES: Milestone[] = [
  {
    key: "first_play",
    emoji: "🌱",
    label: "planted a seed",
    detail: "tried your first playdate",
    test: (p) => p.totalRuns >= 1,
  },
  {
    key: "first_find",
    emoji: "🔍",
    label: "found something",
    detail: "noticed something new during play",
    test: (p) => p.badgeCounts.found_something >= 1,
  },
  {
    key: "first_evidence",
    emoji: "📸",
    label: "captured a moment",
    detail: "added evidence of learning",
    test: (p) => p.totalEvidence >= 1,
  },
  {
    key: "first_fold",
    emoji: "🎨",
    label: "folded & unfolded",
    detail: "created something and changed it",
    test: (p) => p.badgeCounts.folded_unfolded >= 1,
  },
  {
    key: "first_again",
    emoji: "✨",
    label: "found it again",
    detail: "rediscovered the magic later",
    test: (p) => p.badgeCounts.found_again >= 1,
  },
  {
    key: "streak_week",
    emoji: "🔥",
    label: "a week of play",
    detail: "7+ consecutive days of playdates",
    test: (p) => p.longestStreak >= 7,
  },
  {
    key: "first_pack",
    emoji: "📦",
    label: "joined a pack",
    detail: "unlocked your first playdate pack",
    test: (p) => p.ownedPacks.length >= 1,
  },
  {
    key: "pack_complete",
    emoji: "🏆",
    label: "explored every corner",
    detail: "tried every playdate in a pack",
    test: (p) =>
      p.ownedPacks.some(
        (pk) => pk.playdate_count > 0 && pk.tried_count >= pk.playdate_count,
      ),
  },
];

/* ── component ─────────────────────────────────────────────────────── */

export default function ProfileJourney(props: ProfileJourneyProps) {
  const { ownedPacks, creditBalance } = props;

  const achieved = MILESTONES.filter((m) => m.test(props));
  const upcoming = MILESTONES.filter((m) => !m.test(props));
  const nextMilestone = upcoming[0] ?? null;

  /* pack aggregate progress */
  const totalPlaydates = ownedPacks.reduce(
    (s, p) => s + p.playdate_count,
    0,
  );
  const totalTried = ownedPacks.reduce((s, p) => s + p.tried_count, 0);
  const packPct =
    totalPlaydates > 0 ? Math.round((totalTried / totalPlaydates) * 100) : 0;

  /* credit progress — next reward tier */
  const sortedThresholds = Object.entries(REDEMPTION_THRESHOLDS)
    .sort(([, a], [, b]) => a - b);
  const nextReward = sortedThresholds.find(([, t]) => creditBalance < t);
  const creditPct = nextReward
    ? Math.min(100, Math.round((creditBalance / nextReward[1]) * 100))
    : 100;
  const rewardLabel: Record<string, string> = {
    sampler_pdf: "free sampler PDF",
    single_playdate: "unlock a pack",
    full_pack: "unlock a premium pack",
  };

  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold tracking-tight mb-1">
        your journey
      </h2>
      <p className="text-sm text-cadet/40 mb-5">
        milestones you&apos;ve reached and what&apos;s ahead.
      </p>

      {/* ── milestone path ─────────────────────────────────── */}
      <div className="rounded-xl border border-cadet/10 px-5 py-5 mb-4">
        <div className="space-y-0">
          {MILESTONES.map((m, i) => {
            const done = m.test(props);
            const isLast = i === MILESTONES.length - 1;

            return (
              <div key={m.key} className="flex gap-3">
                {/* connector line + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className="flex items-center justify-center rounded-full text-base"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: done
                        ? "rgba(203, 120, 88, 0.12)"
                        : "rgba(39, 50, 72, 0.04)",
                    }}
                  >
                    <span style={{ opacity: done ? 1 : 0.3 }}>
                      {m.emoji}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className="w-px flex-1 min-h-[16px]"
                      style={{
                        backgroundColor: done
                          ? "rgba(203, 120, 88, 0.25)"
                          : "rgba(39, 50, 72, 0.06)",
                      }}
                    />
                  )}
                </div>

                {/* label */}
                <div className="pb-4">
                  <p
                    className="text-sm font-medium leading-none"
                    style={{
                      color: done ? "var(--wv-cadet)" : "var(--wv-cadet)",
                      opacity: done ? 1 : 0.35,
                      paddingTop: 6,
                    }}
                  >
                    {m.label}
                    {done && (
                      <span className="ml-1.5 text-[10px] text-sienna/60 font-normal">
                        ✓
                      </span>
                    )}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color: "var(--wv-cadet)",
                      opacity: done ? 0.45 : 0.2,
                    }}
                  >
                    {m.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* summary line */}
        <div className="mt-2 pt-3 border-t border-cadet/5 flex items-center justify-between">
          <span className="text-xs text-cadet/40">
            {achieved.length} of {MILESTONES.length} milestones reached
          </span>
          {nextMilestone && (
            <span className="text-xs text-sienna/60">
              next: {nextMilestone.label}
            </span>
          )}
        </div>
      </div>

      {/* ── pack progress (only if user owns packs) ──────── */}
      {ownedPacks.length > 0 && (
        <div
          className="rounded-xl border px-5 py-4 mb-4"
          style={{
            borderColor: "rgba(203, 120, 88, 0.15)",
            backgroundColor: "rgba(203, 120, 88, 0.03)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cadet/60">
              pack exploration
            </span>
            <span className="text-xs text-cadet/40">
              {totalTried} of {totalPlaydates} playdates tried
            </span>
          </div>
          <div className="h-2 rounded-full bg-cadet/8 overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${packPct}%`,
                backgroundColor:
                  packPct >= 80
                    ? "var(--wv-redwood)"
                    : packPct >= 40
                      ? "var(--wv-sienna)"
                      : "var(--wv-champagne)",
              }}
            />
          </div>
          {/* per-pack mini bars */}
          {ownedPacks.length > 1 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {ownedPacks.map((pk) => {
                const pPct =
                  pk.playdate_count > 0
                    ? Math.round(
                        (pk.tried_count / pk.playdate_count) * 100,
                      )
                    : 0;
                return (
                  <Link
                    key={pk.id}
                    href={`/packs/${pk.slug}`}
                    className="flex items-center gap-1.5 text-[11px] text-cadet/45 hover:text-sienna/70 transition-colors"
                  >
                    <div
                      className="h-1.5 rounded-full bg-cadet/8 overflow-hidden"
                      style={{ width: 40 }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pPct}%`,
                          backgroundColor:
                            pPct >= 100
                              ? "var(--wv-redwood)"
                              : "var(--wv-sienna)",
                        }}
                      />
                    </div>
                    <span className="truncate max-w-[100px]">{pk.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── credit progress (only if user has credits) ───── */}
      {creditBalance > 0 && (
        <div
          className="rounded-xl border px-5 py-4"
          style={{
            borderColor: "rgba(228, 196, 137, 0.3)",
            backgroundColor: "rgba(228, 196, 137, 0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cadet/60">
              reflection credits
            </span>
            <span className="text-xs font-medium text-champagne">
              {creditBalance} credits
            </span>
          </div>
          <div className="h-2 rounded-full bg-champagne/15 overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${creditPct}%`,
                backgroundColor: "var(--wv-champagne)",
              }}
            />
          </div>
          {nextReward && (
            <p className="text-[11px] text-cadet/35">
              {nextReward[1] - creditBalance} more to{" "}
              {rewardLabel[nextReward[0]] ?? nextReward[0]}
              {" · "}
              <Link
                href="/playbook"
                className="text-sienna/60 hover:text-sienna transition-colors"
              >
                earn more in playbook
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
