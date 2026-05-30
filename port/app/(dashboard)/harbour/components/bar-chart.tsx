/**
 * BarChart — hand-rolled SVG bar chart for user growth.
 *
 * Shows monthly signup bars + a cumulative overlay line.
 * No charting library — pure SVG + CSS custom properties from port's design system.
 */

import type { UserGrowthPoint } from "@/lib/neon/harbour-analytics";

interface Props {
  data: UserGrowthPoint[];
}

const W = 560;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 32, left: 32 };

export function BarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        no data yet
      </div>
    );
  }

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.max(4, Math.floor(chartW / data.length) - 2);
  const maxSignups = Math.max(...data.map((d) => d.signups), 1);
  const maxCumulative = Math.max(...data.map((d) => d.cumulative), 1);

  const barX = (i: number) =>
    PAD.left + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
  const barH = (v: number) => Math.max(2, (v / maxSignups) * chartH);
  const lineY = (v: number) =>
    PAD.top + chartH - (v / maxCumulative) * chartH;
  const lineX = (i: number) =>
    PAD.left + i * (chartW / data.length) + chartW / data.length / 2;

  // Cumulative overlay line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${lineX(i)},${lineY(d.cumulative)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="user growth chart"
      role="img"
    >
      {/* bars */}
      {data.map((d, i) => (
        <rect
          key={d.month}
          x={barX(i)}
          y={PAD.top + chartH - barH(d.signups)}
          width={barW}
          height={barH(d.signups)}
          className="fill-primary/60"
          rx={2}
        >
          <title>{`${d.month}: ${d.signups} signups`}</title>
        </rect>
      ))}

      {/* cumulative line */}
      <path
        d={linePath}
        fill="none"
        className="stroke-primary"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* cumulative dots */}
      {data.map((d, i) => (
        <circle
          key={`dot-${d.month}`}
          cx={lineX(i)}
          cy={lineY(d.cumulative)}
          r={2.5}
          className="fill-primary"
        >
          <title>{`${d.month}: ${d.cumulative} total`}</title>
        </circle>
      ))}

      {/* x-axis month labels — every 3rd to avoid crowding */}
      {data.map((d, i) =>
        i % 3 === 0 ? (
          <text
            key={`label-${d.month}`}
            x={lineX(i)}
            y={H - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
            fontSize={9}
          >
            {d.month.slice(2)} {/* YY-MM */}
          </text>
        ) : null,
      )}
    </svg>
  );
}
