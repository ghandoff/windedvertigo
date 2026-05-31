/**
 * UserStateFlow — Duolingo-inspired 6-bucket user state visualization.
 *
 * Displays users segmented by recency into labelled cards arranged in a
 * natural flow: healthy states (new, current) on the left, risk states in
 * the middle, and lost states on the right. CURR is visually emphasized —
 * research confirmed it has 5× the growth impact of any other metric.
 *
 * No charting library — pure HTML/CSS with Tailwind tokens.
 */

import type { UserStateBuckets } from "@/lib/neon/harbour-observatory";

interface BucketConfig {
  key: keyof Omit<UserStateBuckets, "total">;
  label: string;
  sublabel: string;
  colorClass: string;
  textClass: string;
  borderClass: string;
  emphasis?: boolean;
}

const BUCKETS: BucketConfig[] = [
  {
    key: "new",
    label: "new",
    sublabel: "joined ≤ 14 days",
    colorClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  {
    key: "current",
    label: "current",
    sublabel: "active this week",
    colorClass: "bg-green-50 dark:bg-green-950/30",
    textClass: "text-green-700 dark:text-green-300",
    borderClass: "border-green-200 dark:border-green-800",
    emphasis: true,
  },
  {
    key: "atRiskWau",
    label: "at risk — WAU",
    sublabel: "last active 8–14d",
    colorClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  {
    key: "atRiskMau",
    label: "at risk — MAU",
    sublabel: "last active 15–30d",
    colorClass: "bg-orange-50 dark:bg-orange-950/30",
    textClass: "text-orange-700 dark:text-orange-300",
    borderClass: "border-orange-200 dark:border-orange-800",
  },
  {
    key: "dormant",
    label: "dormant",
    sublabel: "last active > 30d",
    colorClass: "bg-muted/60",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
  {
    key: "neverActive",
    label: "never active",
    sublabel: "signed up, no activity",
    colorClass: "bg-muted/30",
    textClass: "text-muted-foreground/70",
    borderClass: "border-border/50",
  },
];

interface Props {
  buckets: UserStateBuckets;
}

export function UserStateFlow({ buckets }: Props) {
  const total = buckets.total || 1; // avoid div/0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {BUCKETS.map((cfg) => {
          const count = buckets[cfg.key] as number;
          const pct   = Math.round((count / total) * 100);
          return (
            <div
              key={cfg.key}
              className={`rounded-lg border px-3 py-2.5 flex flex-col gap-1 ${cfg.colorClass} ${cfg.borderClass} ${cfg.emphasis ? "ring-1 ring-green-300 dark:ring-green-700" : ""}`}
            >
              <p className={`text-xs font-medium ${cfg.textClass}`}>{cfg.label}</p>
              <p className={`text-2xl font-bold tabular-nums leading-none ${cfg.textClass}`}>
                {count.toLocaleString()}
              </p>
              <p className={`text-[10px] ${cfg.textClass} opacity-70`}>
                {pct}% · {cfg.sublabel}
              </p>
            </div>
          );
        })}
      </div>

      {/* CURR callout — the research finding */}
      <p className="text-[11px] text-muted-foreground">
        <span className="font-medium text-green-600 dark:text-green-400">current</span>
        {" "}= active today or in the past 7 days (harbour's CURR equivalent).
        {" "}Duolingo research: retaining CURR users has 5× the growth impact of any other segment.
      </p>
    </div>
  );
}
