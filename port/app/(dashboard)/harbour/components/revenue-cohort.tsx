/**
 * RevenueCohort — signup-month cohort grid.
 *
 * Rows = signup month cohorts (last 6 months).
 * Columns = months since signup (0–3).
 * Cells = % of cohort that had made a purchase by that month.
 *
 * Deeper colour = higher conversion rate (inline heatmap via opacity).
 * This is the standard SaaS cohort retention view applied to pack commerce.
 */

import type { RevenueCohortRow } from "@/lib/neon/harbour-observatory";

interface Props {
  cohorts: RevenueCohortRow[];
}

function Cell({ value }: { value: number }) {
  const opacity = Math.max(0.08, Math.min(1, value / 30)); // scale to 30% as "full"
  return (
    <td
      className="border border-border px-3 py-2 text-center text-xs tabular-nums"
      style={{ backgroundColor: `rgba(var(--color-primary-rgb, 59,130,246), ${opacity})` }}
    >
      <span className={value > 15 ? "text-white font-medium" : "text-foreground"}>
        {value > 0 ? `${value}%` : "—"}
      </span>
    </td>
  );
}

export function RevenueCohort({ cohorts }: Props) {
  if (cohorts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        no purchase history yet — data appears once users start buying packs.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="border border-border px-3 py-2 text-left text-muted-foreground font-medium bg-muted/30">
              cohort
            </th>
            <th className="border border-border px-3 py-2 text-center text-muted-foreground font-medium bg-muted/30">
              size
            </th>
            <th className="border border-border px-3 py-2 text-center text-muted-foreground font-medium bg-muted/30">
              mo 0
            </th>
            <th className="border border-border px-3 py-2 text-center text-muted-foreground font-medium bg-muted/30">
              mo 1
            </th>
            <th className="border border-border px-3 py-2 text-center text-muted-foreground font-medium bg-muted/30">
              mo 2
            </th>
            <th className="border border-border px-3 py-2 text-center text-muted-foreground font-medium bg-muted/30">
              mo 3
            </th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((row) => (
            <tr key={row.cohortMonth}>
              <td className="border border-border px-3 py-2 font-medium text-foreground bg-muted/10">
                {row.cohortMonth}
              </td>
              <td className="border border-border px-3 py-2 text-center text-muted-foreground tabular-nums">
                {row.cohortSize.toLocaleString()}
              </td>
              <Cell value={row.byMonth0} />
              <Cell value={row.byMonth1} />
              <Cell value={row.byMonth2} />
              <Cell value={row.byMonth3} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        cells show % of cohort who had made any purchase by that month since signing up
      </p>
    </div>
  );
}
