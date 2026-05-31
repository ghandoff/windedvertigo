/**
 * UserStateFlow — "where are your players right now?"
 *
 * Six plain-English buckets derived from last_active_at.
 * The "playing now" bucket is the most important — research shows it has
 * 5× more growth impact than any other segment (Duolingo study).
 *
 * Each bucket label is self-explanatory with a HintIcon tooltip for detail.
 */

import type { UserStateBuckets } from "@/lib/neon/harbour-observatory";
import { HintIcon } from "./hint-icon";

interface BucketConfig {
  key: keyof Omit<UserStateBuckets, "total">;
  label: string;
  sublabel: string;
  hint: string;
  colorClass: string;
  textClass: string;
  borderClass: string;
  emphasis?: boolean;
}

const BUCKETS: BucketConfig[] = [
  {
    key: "new",
    label: "new arrivals",
    sublabel: "joined in the past 2 weeks",
    hint: "Users who signed up within the past 14 days. They're still forming habits — this is when onboarding matters most.",
    colorClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass:  "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  {
    key: "current",
    label: "playing now",
    sublabel: "came back in the past 7 days",
    hint: "Players who were active this week. This is your most valuable segment — Duolingo research found that keeping users in this state has 5× the growth impact of any other action.",
    colorClass:  "bg-green-50 dark:bg-green-950/30",
    textClass:   "text-green-700 dark:text-green-300",
    borderClass: "border-green-300 dark:border-green-700",
    emphasis: true,
  },
  {
    key: "atRiskWau",
    label: "going quiet",
    sublabel: "last played 8–14 days ago",
    hint: "Players who were active last week but haven't shown up this week. A gentle nudge (email, notification) at this stage has the highest chance of re-engaging them.",
    colorClass:  "bg-amber-50 dark:bg-amber-950/30",
    textClass:   "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  {
    key: "atRiskMau",
    label: "slipping away",
    sublabel: "last played 15–30 days ago",
    hint: "Players who were active in the past month but haven't returned recently. Re-engagement is harder here but still possible — a new game launch or content update can bring them back.",
    colorClass:  "bg-orange-50 dark:bg-orange-950/30",
    textClass:   "text-orange-700 dark:text-orange-300",
    borderClass: "border-orange-200 dark:border-orange-800",
  },
  {
    key: "dormant",
    label: "dormant",
    sublabel: "last played over 30 days ago",
    hint: "Players who were active at some point but haven't returned in over a month. These users are unlikely to self-activate — they need a meaningful new reason to come back.",
    colorClass:  "bg-muted/60",
    textClass:   "text-muted-foreground",
    borderClass: "border-border",
  },
  {
    key: "neverActive",
    label: "never played",
    sublabel: "signed up but no activity yet",
    hint: "Users who created an account but have never launched a harbour game. This is wasted signup momentum — investigate whether there's a friction point between sign-up and first play.",
    colorClass:  "bg-muted/30",
    textClass:   "text-muted-foreground/70",
    borderClass: "border-border/50",
  },
];

interface Props {
  buckets: UserStateBuckets;
}

export function UserStateFlow({ buckets }: Props) {
  const total = buckets.total || 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {BUCKETS.map((cfg) => {
          const count = buckets[cfg.key] as number;
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div
              key={cfg.key}
              className={`rounded-lg border px-3 py-2.5 flex flex-col gap-1
                ${cfg.colorClass} ${cfg.borderClass}
                ${cfg.emphasis ? "ring-1 ring-green-400 dark:ring-green-600" : ""}
              `}
            >
              <div className="flex items-start justify-between gap-1">
                <p className={`text-xs font-medium leading-tight ${cfg.textClass}`}>
                  {cfg.label}
                </p>
                <HintIcon text={cfg.hint} />
              </div>
              <p className={`text-2xl font-bold tabular-nums leading-none ${cfg.textClass}`}>
                {count.toLocaleString()}
              </p>
              <p className={`text-[10px] leading-tight ${cfg.textClass} opacity-70`}>
                {pct}% · {cfg.sublabel}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground bg-muted/30 rounded px-3 py-2">
        <span className="font-medium text-green-600 dark:text-green-400">playing now</span>
        {" "}is your most important segment. Focus on keeping players here rather than
        chasing new signups — Duolingo data shows re-engagement has 5× the impact
        on platform growth compared to acquisition.
        {" "}<span className="opacity-60">total registered: {buckets.total.toLocaleString()}</span>
      </p>
    </div>
  );
}
