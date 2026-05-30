/**
 * FunnelChart — hand-rolled conversion funnel visualisation.
 *
 * Each step is a bar whose width is proportional to its count relative to
 * the first step. Drop-off percentage is shown between steps.
 * Pure CSS/HTML — no SVG, no charting library.
 */

import type { FunnelStep } from "@/lib/neon/harbour-analytics";

interface Props {
  steps: FunnelStep[];
}

function pct(n: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

export function FunnelChart({ steps }: Props) {
  const top = steps[0]?.count ?? 0;

  return (
    <div className="space-y-1.5" role="list" aria-label="conversion funnel">
      {steps.map((step, i) => {
        const width = top === 0 ? 0 : Math.max(4, Math.round((step.count / top) * 100));
        const prevCount = i > 0 ? (steps[i - 1]?.count ?? 0) : null;
        const dropOff =
          prevCount !== null && prevCount > 0
            ? Math.round(((prevCount - step.count) / prevCount) * 100)
            : null;

        return (
          <div key={step.label} role="listitem">
            {dropOff !== null && (
              <div className="pl-1 pb-0.5 text-[10px] text-muted-foreground">
                ↓ {dropOff}% drop-off
              </div>
            )}
            <div className="flex items-center gap-2">
              <div
                className="h-7 rounded bg-primary/20 flex items-center px-2 transition-all"
                style={{ width: `${width}%` }}
              >
                <span className="text-xs font-medium text-foreground truncate">
                  {step.label}
                </span>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                {step.count.toLocaleString()}
                <span className="ml-1 text-xs">
                  ({pct(step.count, top)})
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
