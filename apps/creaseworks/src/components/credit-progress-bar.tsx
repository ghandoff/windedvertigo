/**
 * Credit progress bar — "12 / 50 credits toward a free playdate"
 *
 * Server component. Shows current balance relative to the next
 * redemption threshold. Placed on the playbook page above
 * the collections grid.
 */

import { REDEMPTION_THRESHOLDS } from "@/lib/queries/credits";

interface CreditProgressBarProps {
  balance: number;
}

export default function CreditProgressBar({ balance }: CreditProgressBarProps) {
  // Find the next threshold the user hasn't reached
  const thresholds = [
    { key: "sampler_pdf" as const, label: "a free sampler PDF", target: REDEMPTION_THRESHOLDS.sampler_pdf },
    { key: "single_playdate" as const, label: "a free playdate", target: REDEMPTION_THRESHOLDS.single_playdate },
    { key: "full_pack" as const, label: "a free pack", target: REDEMPTION_THRESHOLDS.full_pack },
  ];

  const nextGoal = thresholds.find((t) => balance < t.target) ?? thresholds[thresholds.length - 1];
  const pct = Math.min(Math.round((balance / nextGoal.target) * 100), 100);
  const hasReached = balance >= nextGoal.target;

  if (balance === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-sienna/15 bg-sienna/3 px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-cadet/70">
          {hasReached ? (
            <>you&apos;ve earned enough for {nextGoal.label}!</>
          ) : (
            <>
              {balance} / {nextGoal.target} credits toward {nextGoal.label}
            </>
          )}
        </span>
        <span className="text-[10px] text-cadet/40">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-cadet/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: hasReached
              ? "var(--wv-redwood)"
              : pct >= 60
                ? "var(--wv-sienna)"
                : "var(--wv-champagne)",
          }}
        />
      </div>
      <p className="text-[10px] text-cadet/35 mt-1.5">
        earn credits by logging playdates, adding photos, and trying find again rounds.
      </p>
    </div>
  );
}
