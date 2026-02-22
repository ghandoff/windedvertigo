"use client";

import { useEffect, useState } from "react";
import { brand } from "@windedvertigo/tokens";

/* ------------------------------------------------------------------ */
/*  types (mirroring server-side AnalyticsSummary)                     */
/* ------------------------------------------------------------------ */

interface RunsByType {
  run_type: string;
  count: number;
}

interface RunsOverTime {
  month: string;
  count: number;
}

interface TopPattern {
  pattern_title: string;
  pattern_slug: string;
  count: number;
}

interface TopMaterial {
  material_title: string;
  count: number;
}

interface EvidenceBreakdown {
  evidence_type: string;
  count: number;
}

interface ContextBreakdown {
  context_tag: string;
  count: number;
}

interface AnalyticsData {
  totalRuns: number;
  runsByType: RunsByType[];
  runsOverTime: RunsOverTime[];
  topPatterns: TopPattern[];
  topMaterials: TopMaterial[];
  evidenceBreakdown: EvidenceBreakdown[];
  contextBreakdown: ContextBreakdown[];
  averageEvidencePerRun: number;
  runsThisMonth: number;
  runsLastMonth: number;
}

/* ------------------------------------------------------------------ */
/*  colours (from brand palette)                                       */
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
  "#d4956b", // lighter sienna (chart-specific variant)
  "#8a3d33", // darker redwood (chart-specific variant)
  brand.champagne,
];

/* ------------------------------------------------------------------ */
/*  helper: simple horizontal bar                                      */
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

/* ------------------------------------------------------------------ */
/*  helper: sparkline (CSS only)                                       */
/* ------------------------------------------------------------------ */

function Sparkline({ data }: { data: RunsOverTime[] }) {
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
              backgroundColor: COLOURS.redwood,
            }}
          />
          <span className="text-[10px] opacity-50 rotate-[-45deg] origin-top-left whitespace-nowrap">
            {d.month.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  stat card                                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  main component                                                     */
/* ------------------------------------------------------------------ */

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics/runs")
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

  // Month-over-month delta
  const delta = data.runsThisMonth - data.runsLastMonth;
  const deltaLabel =
    delta > 0
      ? `+${delta} from last month`
      : delta < 0
        ? `${delta} from last month`
        : "same as last month";

  return (
    <div className="space-y-10">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="total runs" value={data.totalRuns} />
        <StatCard label="this month" value={data.runsThisMonth} subtitle={deltaLabel} />
        <StatCard label="run types used" value={data.runsByType.length} />
        <StatCard
          label="avg. evidence per run"
          value={data.averageEvidencePerRun}
        />
      </div>

      {/* Runs over time */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
          runs over time
        </h2>
        <Sparkline data={data.runsOverTime} />
      </section>

      {/* Two-column breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* By type */}
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
            by run type
          </h2>
          <HorizontalBar items={data.runsByType} labelKey="run_type" valueKey="count" />
        </section>

        {/* Top patterns */}
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
            most-used patterns
          </h2>
          <HorizontalBar
            items={data.topPatterns}
            labelKey="pattern_title"
            valueKey="count"
          />
        </section>

        {/* Top materials */}
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
            most-used materials
          </h2>
          <HorizontalBar
            items={data.topMaterials}
            labelKey="material_title"
            valueKey="count"
          />
        </section>

        {/* Evidence breakdown */}
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
            evidence captured
          </h2>
          <HorizontalBar
            items={data.evidenceBreakdown}
            labelKey="evidence_type"
            valueKey="count"
          />
        </section>

        {/* Context tags */}
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLOURS.cadet }}>
            context tags
          </h2>
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
