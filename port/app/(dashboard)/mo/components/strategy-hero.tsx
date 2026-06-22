/**
 * strategy-hero.tsx — full-width hero card at top of /strategy.
 * Server component. Mostly static; takes `subscribers` so the
 * "{x} subscribers / 2,000 target" stat reflects live data when
 * the social-stats snapshot is available.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CASH_ON_HAND,
  PIPELINE_MATH,
  REVENUE_PROGRESS,
  REVENUE_TARGET,
  RUNWAY_MONTHS,
  TIER_PROBABILITY,
  WV_COLOURS,
  deriveRevenueTiers,
  fmt,
  pct,
  type RevenueProgressInput,
} from "@/lib/strategy-data";
import { DollarSign, Target, Calendar, TrendingUp } from "lucide-react";

// Diagonal hatched fills — borrowed from Linear's "in-progress but not
// committed" pattern. Density of stripes encodes dialogue intensity:
//   negotiation = sparse (active back-and-forth, terms still moving)
//   open        = dense  (proposal sitting in someone's inbox, no commit yet)
// Pure CSS so no SVG/icon-font dependency.
const NEGOTIATION_TIER_HATCH =
  "repeating-linear-gradient(45deg, rgba(245,158,11,0.6) 0 3px, rgba(245,158,11,0.2) 3px 11px)";
const OPEN_TIER_HATCH =
  "repeating-linear-gradient(45deg, rgba(245,158,11,0.55) 0 4px, rgba(245,158,11,0.18) 4px 8px)";

const COLOR_PAID = WV_COLOURS.teal; // #43b187 @ 100%
const COLOR_SIGNED = `${WV_COLOURS.teal}A6`; // ~65% alpha — same hue, lower confidence
const COLOR_ADVANCED = "rgba(251, 191, 36, 0.78)"; // amber-400 @ 78% — solid, "almost guaranteed"
const COLOR_NEGOTIATION = "rgba(245, 158, 11, 0.55)"; // amber-500 @ 55% — legend dot for negotiation tier (bar uses hatch)
const COLOR_OPEN_FALLBACK = "rgba(245, 158, 11, 0.4)"; // legend dot color (the bar uses the hatch)

export interface StrategyHeroProps {
  subscribers?: number;
  /** Live revenue data from Supabase. Falls back to hardcoded REVENUE_PROGRESS
   *  when not provided or when the server-side fetch fails. */
  revenueProgress?: RevenueProgressInput;
}

export function StrategyHero({ subscribers = 0, revenueProgress }: StrategyHeroProps) {
  // Cast the fallback so the `as const` literal union widens to RevenueProgressInput,
  // giving consistent access to optional fields like `detail` and `receivedAmount`.
  const activeProgress: RevenueProgressInput = revenueProgress ?? (REVENUE_PROGRESS as RevenueProgressInput);
  const tiers = deriveRevenueTiers(activeProgress);
  const lockedPct = pct(tiers.signed, REVENUE_TARGET);
  const subsTarget = 2000;

  // Bar segment widths as percentages of target. Each tier renders a flex
  // child whose width is `flexBasis: ${pctOfTarget}%`; the remainder is the
  // gap track (white/8) that already exists.
  const widthPct = (n: number) => (n / REVENUE_TARGET) * 100;

  return (
    <Card className="overflow-hidden border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #273248 0%, #3b4a6b 100%)" }}>
      <CardContent className="p-6 md:p-8 space-y-5 text-white">
        {/* top row: title + status badge */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-white/60">
              q2–q3 2026 marketing strategy
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
              ${fmt(REVENUE_TARGET)} by september.
            </h1>
            <p className="text-sm text-white/80 max-w-2xl leading-relaxed">
              we have products, clients, and a platform. what we lack is visibility outside our warm network.
              this strategy treats marketing as a direct revenue function — every campaign tied to a contract.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-white/30 bg-white/10 text-white text-[10px] tracking-wider uppercase"
          >
            cmo: claude · sponsor: garrett
          </Badge>
        </div>

        {/* progress to target — 4-tier confidence ladder
            paid → signed → advanced → open → gap. Replaces both the
            old 2-segment bar here AND the redundant revenue tracker tile
            that used to live at the top of the pipeline tab. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-white/70">progress to target</span>
            <span className="tabular-nums text-white/80">
              <span className="font-semibold" style={{ color: WV_COLOURS.teal }}>
                ${fmt(tiers.signed)}
              </span>{" "}
              signed ({lockedPct}%) · ${fmt(Math.round(tiers.expected))} weighted pipeline
            </span>
          </div>

          {/* the bar */}
          <div
            className="h-2.5 rounded-full overflow-hidden flex"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            {tiers.paid > 0 && (
              <div
                className="h-full"
                style={{ width: `${widthPct(tiers.paid)}%`, backgroundColor: COLOR_PAID }}
                title={`$${fmt(tiers.paid)} paid (cash in bank)`}
              />
            )}
            {tiers.signedUnpaid > 0 && (
              <div
                className="h-full"
                style={{ width: `${widthPct(tiers.signedUnpaid)}%`, backgroundColor: COLOR_SIGNED }}
                title={`$${fmt(tiers.signedUnpaid)} signed, payment pending`}
              />
            )}
            {/* Pipeline tiers render at PROBABILITY-WEIGHTED width (expected value),
                not full potential — a submitted proposal isn't worth its sticker
                price. The solid teal signed segments above are the headline; these
                lighter weighted segments are the secondary "expected pipeline" band. */}
            {tiers.advanced > 0 && (
              <div
                className="h-full"
                style={{ width: `${widthPct(tiers.advanced * TIER_PROBABILITY.advanced)}%`, backgroundColor: COLOR_ADVANCED }}
                title={`$${fmt(tiers.advanced)} advanced × ${TIER_PROBABILITY.advanced} = $${fmt(Math.round(tiers.advanced * TIER_PROBABILITY.advanced))} expected`}
              />
            )}
            {tiers.negotiation > 0 && (
              <div
                className="h-full"
                style={{ width: `${widthPct(tiers.negotiation * TIER_PROBABILITY.negotiation)}%`, backgroundImage: NEGOTIATION_TIER_HATCH }}
                title={`$${fmt(tiers.negotiation)} negotiating × ${TIER_PROBABILITY.negotiation} = $${fmt(Math.round(tiers.negotiation * TIER_PROBABILITY.negotiation))} expected`}
              />
            )}
            {tiers.open > 0 && (
              <div
                className="h-full"
                style={{ width: `${widthPct(tiers.open * TIER_PROBABILITY.open)}%`, backgroundImage: OPEN_TIER_HATCH }}
                title={`$${fmt(tiers.open)} open × ${TIER_PROBABILITY.open} = $${fmt(Math.round(tiers.open * TIER_PROBABILITY.open))} expected`}
              />
            )}
          </div>

          {/* tier legend — glyph progression reinforces the confidence ladder
              for users who don't read color */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/60 tabular-nums">
            <TierGlyph color={COLOR_PAID} label={`$${fmt(tiers.paid)} paid`} fill="solid" />
            <TierGlyph color={COLOR_SIGNED} label={`$${fmt(tiers.signedUnpaid)} signed`} fill="solid" />
            <TierGlyph color={COLOR_ADVANCED} label={`$${fmt(tiers.advanced)} advanced`} fill="solid" />
            <TierGlyph color={COLOR_NEGOTIATION} label={`$${fmt(tiers.negotiation)} negotiating`} fill="ring" />
            <TierGlyph color={COLOR_OPEN_FALLBACK} label={`$${fmt(tiers.open)} open`} fill="ring" />
            <span className="text-white/40">·</span>
            <span className="text-white/50">
              ${fmt(Math.round(tiers.expected))} weighted of ${fmt(REVENUE_TARGET)} target
            </span>
            <span className="text-white/35">(pipeline weighted by likelihood)</span>
          </div>

          {/* per-contract attribution — moved here from the deleted revenue
              tracker tile. Each chip's left-edge dot color matches its bar
              segment; PRME splits across paid + signed so it shows two dots.
              Nordic Budget A vs Budget B render as two separate chips at
              different confidence tiers (A = advanced, B = negotiation). */}
          <div className="flex flex-wrap gap-2 pt-1">
            {activeProgress.breakdown.map((row) => {
              // Some rows (Nordic A/B) carry an optional scope blurb so the
              // chip can disambiguate two budgets under the same client.
              const scope = row.detail;
              if (row.status === "signed") {
                const paidPart = row.receivedAmount ?? 0;
                const signedPart = row.amount - paidPart;
                return (
                  <ContractChip
                    key={row.client}
                    name={row.client}
                    scope={scope}
                    dots={[
                      ...(paidPart > 0 ? [{ color: COLOR_PAID, solid: true }] : []),
                      { color: COLOR_SIGNED, solid: true },
                    ]}
                    detail={
                      paidPart > 0
                        ? `$${fmt(paidPart)} paid · $${fmt(signedPart)} signed`
                        : `$${fmt(signedPart)} signed`
                    }
                  />
                );
              }
              if (row.status === "in-progress") {
                return (
                  <ContractChip
                    key={row.client}
                    name={row.client}
                    scope={scope}
                    dots={[{ color: COLOR_ADVANCED, solid: true }]}
                    detail={`$${fmt(row.amount)} advanced`}
                  />
                );
              }
              if (row.status === "negotiation") {
                return (
                  <ContractChip
                    key={row.client}
                    name={row.client}
                    scope={scope}
                    dots={[{ color: COLOR_NEGOTIATION, solid: false }]}
                    detail={`$${fmt(row.amount)} negotiating`}
                  />
                );
              }
              // documentation → open
              return (
                <ContractChip
                  key={row.client}
                  name={row.client}
                  scope={scope}
                  dots={[{ color: COLOR_OPEN_FALLBACK, solid: false }]}
                  detail={`$${fmt(row.amount)} open`}
                />
              );
            })}
          </div>
        </div>

        {/* stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="cash on hand"
            value={`~$${fmt(CASH_ON_HAND)}`}
            sub={`${RUNWAY_MONTHS}-month runway`}
          />
          <Stat
            icon={<Target className="h-4 w-4" />}
            label="contracts needed"
            value={`${PIPELINE_MATH.contractsNeeded}`}
            sub={`@ $${fmt(PIPELINE_MATH.averageContractValue)} avg`}
          />
          <Stat
            icon={<Calendar className="h-4 w-4" />}
            label="rhythm"
            value={`${PIPELINE_MATH.proposalsPerMonth}/mo`}
            sub={`proposals · ${PIPELINE_MATH.outreachTouchesPerWeek} touches/wk`}
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="substack subs"
            value={fmt(subscribers)}
            sub={`${pct(subscribers, subsTarget)}% of ${fmt(subsTarget)}`}
          />
        </div>

        {/* three-layer arc */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10">
          <Layer
            stage="may"
            label="immediate activation"
            description="warm network · harbour launch"
          />
          <Layer
            stage="jun–jul"
            label="amplification"
            description="conferences · community · cold refresh"
          />
          <Layer
            stage="aug–sep"
            label="scaling"
            description="convert wins to retainers + product revenue"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-white/60 text-[10px] uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-white/50">{sub}</p>
    </div>
  );
}

function TierGlyph({
  color,
  label,
  fill,
}: {
  color: string;
  label: string;
  /** "solid" = filled circle (high confidence), "ring" = hollow circle (open proposal) */
  fill: "solid" | "ring";
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={
          fill === "solid"
            ? { backgroundColor: color }
            : { border: `1.5px dashed ${color}`, backgroundColor: "transparent" }
        }
      />
      {label}
    </span>
  );
}

function ContractChip({
  name,
  scope,
  dots,
  detail,
}: {
  name: string;
  /** Optional scope blurb (e.g. "retainer · $6k/mo · apr–dec 2026") rendered
   * after the contract name in muted text. Used to disambiguate two budgets
   * under the same client. */
  scope?: string;
  dots: { color: string; solid: boolean }[];
  detail: string;
}) {
  return (
    <span
      className="text-[10px] px-2 py-1 rounded-full inline-flex items-center gap-1.5"
      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
    >
      <span className="inline-flex items-center gap-0.5">
        {dots.map((d, i) => (
          <span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={
              d.solid
                ? { backgroundColor: d.color }
                : { border: `1px dashed ${d.color}`, backgroundColor: "transparent" }
            }
          />
        ))}
      </span>
      <span className="font-medium text-white/90">{name}</span>
      {scope && <span className="text-white/50">· {scope}</span>}
      <span className="text-white/60 tabular-nums">· {detail}</span>
    </span>
  );
}

function Layer({
  stage,
  label,
  description,
}: {
  stage: string;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/50">
          {stage}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-[11px] text-white/70 mt-0.5 leading-snug">{description}</p>
    </div>
  );
}
