/**
 * RevenueCohort — "when do users make their first purchase?"
 *
 * Each row is a group of users who signed up in the same month.
 * Each cell shows what % of that group had bought a pack by that point in time.
 * Darker cells = higher conversion. Empty cells = cohort hasn't reached that age yet.
 */

import type { RevenueCohortRow } from "@/lib/neon/harbour-observatory";
import { HintIcon } from "./hint-icon";

interface Props {
  cohorts: RevenueCohortRow[];
}

function Cell({ value, cohortSize }: { value: number; cohortSize: number }) {
  if (cohortSize === 0) return <td className="border border-border px-3 py-2 text-center text-muted-foreground/40 text-xs">—</td>;
  const absCount = Math.round((value / 100) * cohortSize);
  const opacity  = Math.max(0.06, Math.min(0.9, value / 25));
  return (
    <td
      className="border border-border px-3 py-2 text-center text-xs tabular-nums cursor-default"
      style={{ backgroundColor: `color-mix(in srgb, var(--color-primary, #3b82f6) ${Math.round(opacity * 100)}%, transparent)` }}
      title={value > 0 ? `${absCount} of ${cohortSize} users (${value}%)` : "no purchases yet"}
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
        no purchase history yet — this table fills in once users start buying packs.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr>
              <th className="border border-border px-3 py-2 text-left text-muted-foreground font-medium bg-muted/30 whitespace-nowrap">
                signup month
              </th>
              <th className="border border-border px-3 py-2 text-center text-muted-foreground font-medium bg-muted/30 whitespace-nowrap">
                users
              </th>
              <th className="border border-border px-3 py-2 text-center bg-muted/30 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1 text-muted-foreground font-medium">
                  same month
                  <HintIcon text="% of this cohort who made their first purchase within the same month they signed up." />
                </div>
              </th>
              <th className="border border-border px-3 py-2 text-center bg-muted/30 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1 text-muted-foreground font-medium">
                  after 1 month
                  <HintIcon text="% who had purchased within 2 months of signing up (cumulative)." />
                </div>
              </th>
              <th className="border border-border px-3 py-2 text-center bg-muted/30 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1 text-muted-foreground font-medium">
                  after 2 months
                  <HintIcon text="% who had purchased within 3 months of signing up (cumulative)." />
                </div>
              </th>
              <th className="border border-border px-3 py-2 text-center bg-muted/30 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1 text-muted-foreground font-medium">
                  after 3 months
                  <HintIcon text="% who had purchased within 4 months of signing up (cumulative)." />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row) => (
              <tr key={row.cohortMonth}>
                <td className="border border-border px-3 py-2 font-medium text-foreground bg-muted/10 whitespace-nowrap">
                  {row.cohortMonth}
                </td>
                <td className="border border-border px-3 py-2 text-center text-muted-foreground tabular-nums">
                  {row.cohortSize.toLocaleString()}
                </td>
                <Cell value={row.byMonth0} cohortSize={row.cohortSize} />
                <Cell value={row.byMonth1} cohortSize={row.cohortSize} />
                <Cell value={row.byMonth2} cohortSize={row.cohortSize} />
                <Cell value={row.byMonth3} cohortSize={row.cohortSize} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        hover a cell to see the raw count. darker = higher conversion rate.
        each row represents users who signed up in that month.
      </p>
    </div>
  );
}
