"use client";

import { useEffect, useState } from "react";
import { brand } from "@windedvertigo/tokens";
import { apiUrl } from "@/lib/api-url";

/* ------------------------------------------------------------------ */
/*  types (mirroring server-side AnalyticsSummary + AdminAnalytics)     */
/* ------------------------------------------------------------------ */

interface RunsOverTime {
  month: string;
  count: number;
}

interface AdminAnalytics {
  totalUsers: number;
  activeUsersThisMonth: number;
  userGrowth: { month: string; signups: number; cumulative: number }[];
  packAdoption: { pack_title: string; org_count: number; user_count: number; total: number }[];
  creditEconomy: {
    total_earned: number;
    total_spent: number;
    total_balance: number;
    by_reason: { reason: string; amount: number }[];
  };
  funnel: { label: string; count: number }[];
}

interface AnalyticsData {
  totalRuns: number;
  runsByType: { run_type: string; count: number }[];
  runsOverTime: RunsOverTime[];
  topPlaydates: { playdate_title: string; playdate_slug: string; count: number }[];
  topMaterials: { material_title: string; count: number }[];
  evidenceBreakdown: { evidence_type: string; count: number }[];
  contextBreakdown: { context_tag: string; count: number }[];
  averageEvidencePerRun: number;
  runsThisMonth: number;
  runsLastMonth: number;
  admin?: AdminAnalytics;
}

/* ------------------------------------------------------------------ */
/*  colours                                                            */
/* ------------------------------------------------------------------ */

const COLOURS = {
  cadet: brand.cadet,
  redwood: brand.redwood,
  sienna: brand.sienna,
  champagne: brand.champagne,
};

const BAR_COLOURS = [
  brand.redwood,
  brand.sienna,
  brand.cadet,
  "#d4956b",
  "#8a3d33",
  brand.champagne,
];

/* ------------------------------------------------------------------ */
/*  shared helpers                                                     */
/* ------------------------------------------------------------------ */

function HorizontalBar({
  items,
  labelKey,
  valueKey,
  maxItems = 10,
}: {
  items: any[];
  labelKey: string;
  valueKey: string;
  maxItems?: number;
}) {
  const display = items.slice(0, maxItems);
  const max = Math.max(...display.map((d) => d[valueKey]), 1);

  return (
    <div className="space-y-2">
      {display.map((item, i) => (
        <div key={item[labelKey]} className="flex items-center gap-3">
          <span className="text-sm w-36 truncate text-right" title={item[labelKey]}>
            {item[labelKey]}
          </span>
          <div className="flex-1 h-6 rounded overflow-hidden" style={{ backgroundColor: "#f0e6d9" }}>
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${(item[valueKey] / max) * 100}%`,
                backgroundColor: BAR_COLOURS[i % BAR_COLOURS.length],
              }}
            />
          </div>
          <span className="text-sm font-medium w-8 text-right">{item[valueKey]}</span>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm opacity-50 italic">no data yet</p>
      )}
    </div>
  );
}

function Sparkline({ data, colour = COLOURS.redwood }: { data: { month: string; count: number }[]; colour?: string }) {
  if (data.length === 0) {
    return <p className="text-sm opacity-50 italic">no data yet</p>;
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{
              height: `${(d.count / max) * 100}%`,
              minHeight: d.count > 0 ? "4px" : "0",
              backgroundColor: colour,
            }}
          />
          <span className="text-2xs opacity-50 rotate-[-45deg] origin-top-left whitespace-nowrap">
            {d.month.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 border"
      style={{ borderColor: "#e8ddd0", backgroundColor: "#fffbf5" }}
    >
      <p className="text-sm opacity-60 mb-1">{label}</p>
      <p className="text-3xl font-semibold" style={{ color: COLOURS.cadet }}>
        {value}
      </p>
      {subtitle && <p className="text-xs opacity-40 mt-1">{subtitle}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  conversion funnel                                                  */
/* ------------------------------------------------------------------ */

function FunnelChart({ steps }: { steps: { label: string; count: number }[] }) {
  if (steps.length === 0 || steps[0].count === 0) {
    return <p className="text-sm opacity-50 italic">no data yet</p>;
  }

  const maxCount = steps[0].count;

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
        const dropoff = i > 0 && steps[i - 1].count > 0
          ? Math.round(((steps[i - 1].count - step.count) / steps[i - 1].count) * 100)
          : null;

        return (
          <div key={step.label} className="flex items-center gap-3">
            <span className="text-sm w-32 text-right truncate">{step.label}</span>
            <div className="flex-1 h-8 rounded overflow-hidden" style={{ backgroundColor: "#f0e6d9" }}>
              <div
                className="h-full rounded flex items-center px-3 transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: BAR_COLOURS[i % BAR_COLOURS.length],
                }}
              >
                <span className="text-xs font-medium text-white drop-shadow-sm">
                  {step.count}
                </span>
              </div>
            </div>
            {dropoff !== null && dropoff > 0 && (
              <span className="text-xs opacity-40 w-16 text-right">
                −{dropoff}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  pack adoption stacked bar                                          */
/* ------------------------------------------------------------------ */

function PackAdoptionChart({ packs }: { packs: AdminAnalytics["packAdoption"] }) {
  if (packs.length === 0) {
    return <p className="text-sm opacity-50 italic">no packs adopted yet</p>;
  }

  const max = Math.max(...packs.map((p) => p.total), 1);

  return (
    <div className="space-y-3">
      {packs.map((pack) => (
        <div key={pack.pack_title} className="flex items-center gap-3">
          <span className="text-sm w-36 truncate text-right" title={pack.pack_title}>
            {pack.pack_title}
          </span>
          <div className="flex-1 h-6 rounded overflow-hidden flex" style={{ backgroundColor: "#f0e6d9" }}>
            {pack.org_count > 0 && (
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(pack.org_count / max) * 100}%`,
                  backgroundColor: COLOURS.cadet,
                }}
                title={`${pack.org_count} org`}
              />
            )}
            {pack.user_count > 0 && (
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(pack.user_count / max) * 100}%`,
                  backgroundColor: COLOURS.sienna,
                }}
                title={`${pack.user_count} individual`}
              />
            )}
          </div>
          <span className="text-sm font-medium w-8 text-right">{pack.total}</span>
        </div>
      ))}
      <div className="flex gap-4 text-xs opacity-40 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLOURS.cadet }} /> org
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLOURS.sienna }} /> individual
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  main component                                                     */
/* ------------------------------------------------------------------ */

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/analytics/runs"))
      .then(async (res) => {
        if (!res.ok) throw new Error("failed to load analytics");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: COLOURS.champagne, borderTopColor: COLOURS.redwood }}
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-24">
        <p className="text-sm opacity-50">{error ?? "something went wrong"}</p>
      </div>
    );
  }

  const delta = data.runsThisMonth - data.runsLastMonth;
  const deltaLabel =
    delta > 0
      ? `+${delta} from last month`
      : delta < 0
        ? `${delta} from last month`
        : "same as last month";

  const admin = data.admin;

  return (
    <div className="space-y-12">
      {/* ── platform overview (admin only) ──────────────────────────── */}
      {admin && (
        <>
          <section>
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-6 pb-2 border-b"
              style={{ color: COLOURS.sienna, borderColor: "#e8ddd0" }}
            >
              platform overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="total users" value={admin.totalUsers} />
              <StatCard label="active this month" value={admin.activeUsersThisMonth} />
              <StatCard
                label="credits earned"
                value={admin.creditEconomy.total_earned}
                subtitle={`${admin.creditEconomy.total_spent} redeemed`}
              />
              <StatCard
                label="credit balance (all users)"
                value={admin.creditEconomy.total_balance}
              />
            </div>
          </section>

          {/* user growth sparkline */}
          <section>
            <SectionHeading>user growth (12 months)</SectionHeading>
            <Sparkline
              data={admin.userGrowth.map((g) => ({ month: g.month, count: g.signups }))}
              colour={COLOURS.sienna}
            />
          </section>

          {/* conversion funnel */}
          <section>
            <SectionHeading>conversion funnel</SectionHeading>
            <FunnelChart steps={admin.funnel} />
          </section>

          {/* pack adoption */}
          <section>
            <SectionHeading>pack adoption</SectionHeading>
            <PackAdoptionChart packs={admin.packAdoption} />
          </section>

          {/* credit economy by reason */}
          <section>
            <SectionHeading>credits by action</SectionHeading>
            <HorizontalBar
              items={admin.creditEconomy.by_reason}
              labelKey="reason"
              valueKey="amount"
            />
          </section>

          {/* divider */}
          <hr style={{ borderColor: "#e8ddd0" }} />
        </>
      )}

      {/* ── reflection analytics ──────────────────────────────────── */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-6 pb-2 border-b"
          style={{ color: COLOURS.sienna, borderColor: "#e8ddd0" }}
        >
          reflection analytics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="total reflections" value={data.totalRuns} />
          <StatCard label="this month" value={data.runsThisMonth} subtitle={deltaLabel} />
          <StatCard label="contexts of use" value={data.runsByType.length} />
          <StatCard
            label="avg. evidence per reflection"
            value={data.averageEvidencePerRun}
          />
        </div>
      </section>

      {/* reflections over time */}
      <section>
        <SectionHeading>reflections over time</SectionHeading>
        <Sparkline data={data.runsOverTime} />
      </section>

      {/* two-column breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section>
          <SectionHeading>by context of use</SectionHeading>
          <HorizontalBar items={data.runsByType} labelKey="run_type" valueKey="count" />
        </section>

        <section>
          <SectionHeading>most-used playdates</SectionHeading>
          <HorizontalBar
            items={data.topPlaydates}
            labelKey="playdate_title"
            valueKey="count"
          />
        </section>

        <section>
          <SectionHeading>most-used materials</SectionHeading>
          <HorizontalBar
            items={data.topMaterials}
            labelKey="material_title"
            valueKey="count"
          />
        </section>

        <section>
          <SectionHeading>evidence captured</SectionHeading>
          <HorizontalBar
            items={data.evidenceBreakdown}
            labelKey="evidence_type"
            valueKey="count"
          />
        </section>

        <section>
          <SectionHeading>context tags</SectionHeading>
          <HorizontalBar
            items={data.contextBreakdown}
            labelKey="context_tag"
            valueKey="count"
          />
        </section>
      </div>
    </div>
  );
}
