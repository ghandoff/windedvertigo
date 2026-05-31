/**
 * KnotsSparkline — 30-day earned/spent activity sparkline.
 *
 * Shows daily knots earned (bars) and spent (inverse bars) over 30 days.
 * The visual language is a simple activity histogram — at-a-glance trend.
 */

import type { KnotsDay } from "@/lib/neon/harbour-observatory";

const W = 320;
const H = 60;
const EARN_H = 44;  // max height for earned bars
const SPENT_H = 12; // max height for spent bars

interface Props {
  data: KnotsDay[];
  totalEarned: number;
  totalSpent: number;
}

export function KnotsSparkline({ data, totalEarned, totalSpent }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
        no knots activity in past 30 days
      </div>
    );
  }

  const maxEarned = Math.max(...data.map((d) => d.earned), 1);
  const maxSpent  = Math.max(...data.map((d) => d.spent),  1);
  const barW      = Math.max(2, Math.floor(W / data.length) - 1);
  const barX      = (i: number) => i * (W / data.length) + (W / data.length - barW) / 2;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/60 mr-1 align-middle" />
          earned {totalEarned.toLocaleString()}
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400/60 mr-1 align-middle" />
          spent {totalSpent.toLocaleString()}
        </span>
        <span className="ml-auto">past 30 days</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="knots activity sparkline" role="img">
        {data.map((d, i) => {
          const earnH = Math.max(1, (d.earned / maxEarned) * EARN_H);
          const spentH = Math.max(1, (d.spent  / maxSpent)  * SPENT_H);
          const x = barX(i);
          return (
            <g key={d.date}>
              {/* Earned bar (grows upward from midline) */}
              <rect
                x={x}
                y={EARN_H - earnH}
                width={barW}
                height={earnH}
                className="fill-primary/60"
                rx={1}
              >
                <title>{`${d.date}: +${d.earned} earned`}</title>
              </rect>
              {/* Spent bar (grows downward from midline) */}
              {d.spent > 0 && (
                <rect
                  x={x}
                  y={EARN_H + 2}
                  width={barW}
                  height={spentH}
                  className="fill-orange-400/60"
                  rx={1}
                >
                  <title>{`${d.date}: -${d.spent} spent`}</title>
                </rect>
              )}
            </g>
          );
        })}
        {/* Midline */}
        <line x1={0} y1={EARN_H} x2={W} y2={EARN_H} className="stroke-border" strokeWidth={0.5} />
      </svg>
    </div>
  );
}
