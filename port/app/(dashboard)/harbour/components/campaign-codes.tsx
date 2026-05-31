/**
 * CampaignCodes — "who's using your access codes?"
 *
 * Shows per-campaign redemption stats, a 30-day daily redemption chart,
 * and activation rates (did users who redeemed actually come back?).
 */

import type { AccessCodeMetrics } from "@/lib/neon/harbour-observatory";
import { HintIcon } from "./hint-icon";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ── sparkline bar chart (reuses the same SVG pattern as knots-sparkline) ──

const W = 480;
const H = 56;
const EARN_H = 48;

interface RedemptionSparklineProps {
  data: Array<{ date: string; campaign: string; count: number }>;
}

function RedemptionSparkline({ data }: RedemptionSparklineProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-14 items-center justify-center text-xs text-muted-foreground">
        no redemptions in the past 30 days
      </div>
    );
  }

  // Aggregate by date across campaigns (stacked)
  const byDate = new Map<string, number>();
  for (const d of data) {
    byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.count);
  }
  const dates = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  const maxCount = Math.max(...dates.map(([, n]) => n), 1);
  const barW = Math.max(2, Math.floor(W / dates.length) - 1);
  const barX = (i: number) => i * (W / dates.length) + (W / dates.length - barW) / 2;
  const barH = (n: number) => Math.max(2, (n / maxCount) * EARN_H);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="daily redemptions" role="img">
      {dates.map(([date, count], i) => (
        <rect
          key={date}
          x={barX(i)}
          y={H - barH(count)}
          width={barW}
          height={barH(count)}
          className="fill-primary/60"
          rx={1}
        >
          <title>{`${date}: ${count} redemption${count !== 1 ? "s" : ""}`}</title>
        </rect>
      ))}
    </svg>
  );
}

// ── activation rate badge ──────────────────────────────────────────────────

function ActivationBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const colour = pct >= 60 ? "text-green-600 dark:text-green-400"
               : pct >= 30 ? "text-amber-600 dark:text-amber-400"
               :             "text-red-500";
  return (
    <span className={`tabular-nums font-medium ${colour}`} title="% who were active after redeeming">
      {pct}%
    </span>
  );
}

// ── main component ─────────────────────────────────────────────────────────

interface Props {
  metrics: AccessCodeMetrics;
}

export function CampaignCodes({ metrics }: Props) {
  const { byCampaign, dailyRedemptions30d, totalRedemptionsAllTime, totalActiveCodes } = metrics;

  if (totalActiveCodes === 0 && totalRedemptionsAllTime === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <p className="font-medium">no access codes yet</p>
        <p className="text-xs mt-1">
          create codes at{" "}
          <a
            href="https://windedvertigo.com/harbour/creaseworks/admin/access-codes"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            creaseworks admin → access codes
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">active campaigns</p>
          <p className="text-xl font-semibold tabular-nums">{byCampaign.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">active codes</p>
          <p className="text-xl font-semibold tabular-nums">{totalActiveCodes.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">total redeemed</p>
          <p className="text-xl font-semibold tabular-nums">{totalRedemptionsAllTime.toLocaleString()}</p>
        </div>
      </div>

      {/* Per-campaign table */}
      {byCampaign.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>campaign</TableHead>
                <TableHead className="text-right">codes</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    redeemed
                    <HintIcon text="Total number of users who have redeemed a code from this campaign." />
                  </div>
                </TableHead>
                <TableHead className="text-right">this week</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    activated
                    <HintIcon text="Of users who redeemed a code, what % were active again afterwards? This is the PostHog-style activation signal — did they actually use what they unlocked?" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCampaign.map((row) => (
                <TableRow key={row.campaign}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.campaign}
                      </Badge>
                      {row.activeCodes === 0 && (
                        <span className="text-[10px] text-muted-foreground">expired</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{row.activeCodes}</span>
                    <span className="text-muted-foreground text-xs"> / {row.totalCodes}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.totalRedemptions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.redemptionsThisWeek > 0
                      ? <span className="text-green-600 dark:text-green-400">{row.redemptionsThisWeek}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.totalRedemptions > 0
                      ? <ActivationBadge rate={row.activationRate} />
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 30-day daily chart */}
      {dailyRedemptions30d.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">daily redemptions — past 30 days</p>
          <RedemptionSparkline data={dailyRedemptions30d} />
        </div>
      )}

      {/* Activation rate explainer */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        <span className="font-medium text-green-600 dark:text-green-400">activation rate</span>
        {" "}= % of redeeming users who were active in harbour after their redemption date.
        green ≥ 60% · amber 30–59% · red &lt; 30%.
        a low rate means users redeemed but didn&apos;t return — check whether the unlocked
        content was visible and easy to find.
      </p>
    </div>
  );
}
