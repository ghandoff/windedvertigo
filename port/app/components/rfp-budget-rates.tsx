/**
 * RfpBudgetRates — server component that surfaces Fin's rate reference data
 * on the RFP detail page, scoped to the funder type and geography of the bid.
 *
 * Renders a compact card so the team can sanity-check the budget before
 * submitting. Part of BIZ-K1: defensible budget rate card.
 */

import { DollarSign, TrendingUp } from "lucide-react";
import { queryRateReference } from "@/lib/notion/rate-reference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function fmtRate(low: number | null, high: number | null): string {
  if (low != null && high != null) {
    return `$${low.toLocaleString()}–$${high.toLocaleString()}/day`;
  }
  if (low != null) return `$${low.toLocaleString()}/day`;
  if (high != null) return `$${high.toLocaleString()}/day`;
  return "rate TBD";
}

function impliedDays(estimatedValue: number, low: number | null, high: number | null): string | null {
  const mid =
    low != null && high != null
      ? (low + high) / 2
      : low ?? high;
  if (!mid || mid <= 0) return null;
  const days = Math.round(estimatedValue / mid);
  return `~${days.toLocaleString()} day${days === 1 ? "" : "s"} at median rate`;
}

// ── component ────────────────────────────────────────────────────────────────

interface Props {
  funderType?: string;
  geography?: string;
  estimatedValue?: number;
}

export async function RfpBudgetRates({ funderType, geography, estimatedValue }: Props) {
  const rates = await queryRateReference({ funderType, geography }).catch(() => []);

  if (rates.length === 0) return null;

  // Compute a single aggregate median rate across all returned rows (for the
  // sanity-check line) — use midpoint of each row's range.
  const mids = rates
    .map((r) =>
      r.dailyRateLow != null && r.dailyRateHigh != null
        ? (r.dailyRateLow + r.dailyRateHigh) / 2
        : r.dailyRateLow ?? r.dailyRateHigh,
    )
    .filter((v): v is number => v != null);
  const overallMidLow = mids.length > 0 ? Math.min(...mids) : null;
  const overallMidHigh = mids.length > 0 ? Math.max(...mids) : null;

  const sanityLine =
    estimatedValue != null && estimatedValue > 0 && overallMidLow != null
      ? impliedDays(estimatedValue, overallMidLow, overallMidHigh)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0" />
          budget reference rates
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-1.5">
          {rates.map((r) => {
            const meta = [r.funderType, r.geography]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={r.id} className="text-xs leading-snug">
                <span className="font-medium text-foreground">{r.role}</span>
                <span className="text-muted-foreground">
                  {" "}— {fmtRate(r.dailyRateLow, r.dailyRateHigh)}
                  {meta ? ` · ${meta}` : ""}
                </span>
              </li>
            );
          })}
        </ul>

        {estimatedValue != null && estimatedValue > 0 && (
          <div className="flex items-start gap-1.5 pt-1 border-t border-border">
            <DollarSign className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="text-xs text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">
                estimated value: {fmtMoney(estimatedValue)}
              </span>
              {sanityLine && (
                <span> — {sanityLine}</span>
              )}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 pt-0.5">
          rates from Fin — update via the rates database
        </p>
      </CardContent>
    </Card>
  );
}
