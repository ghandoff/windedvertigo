"use client";

import { useEffect, useState } from "react";
import { brand } from "@windedvertigo/tokens";
import { apiUrl } from "@/lib/api-url";

/* ------------------------------------------------------------------ */
/*  types (mirroring server-side HarborStatus)                         */
/* ------------------------------------------------------------------ */

interface ContentCounts {
  playdates: number;
  materials: number;
  vaultActivities: number;
  packs: number;
  cmsPages: number;
  collections: number;
}

interface UserStats {
  totalUsers: number;
  totalOrgs: number;
  activeUsersThisMonth: number;
  activeUsersLastMonth: number;
  signupsThisMonth: number;
}

interface EntitlementStats {
  activeEntitlements: number;
  orgEntitlements: number;
  userEntitlements: number;
  totalPurchases: number;
  revenueThisMonth: number;
}

interface RunStats {
  totalRuns: number;
  runsThisMonth: number;
  runsLastMonth: number;
  uniqueReflectors: number;
  avgRunsPerUser: number;
}

interface ContentFreshness {
  table: string;
  rowCount: number;
  lastUpdated: string | null;
}

interface TopItem {
  name: string;
  count: number;
}

interface RevenueStats {
  totalRevenueCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  avgOrderCents: number;
  purchasesByPack: { name: string; count: number; revenueCents: number }[];
  revenueTrend: { month: string; revenueCents: number; count: number }[];
  recentPurchases: {
    pack: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }[];
}

interface DeploymentInfo {
  app: string;
  state: string;
  url: string;
  createdAt: number;
  commitMessage: string;
  commitRef: string;
}

interface HarborStatus {
  content: ContentCounts;
  users: UserStats;
  entitlements: EntitlementStats;
  runs: RunStats;
  freshness: ContentFreshness[];
  topPlaydates: TopItem[];
  topVaultActivities: TopItem[];
  recentSignups: { month: string; count: number }[];
  revenue: RevenueStats;
  deployments: DeploymentInfo[];
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
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCents(cents: number, currency = "AUD"): string {
  const symbol = currency === "USD" ? "$" : currency === "AUD" ? "A$" : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatDeployAge(timestamp: number): string {
  if (!timestamp) return "unknown";
  const now = Date.now();
  const diffMs = now - timestamp;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DEPLOY_STATE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  READY: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  BUILDING: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  QUEUED: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  ERROR: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  CANCELED: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};

/* ------------------------------------------------------------------ */
/*  shared components                                                  */
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-widest mb-6 pb-2 border-b"
      style={{ color: COLOURS.sienna, borderColor: "#e8ddd0" }}
    >
      {children}
    </h2>
  );
}

function HorizontalBar({
  items,
  labelKey,
  valueKey,
}: {
  items: any[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(...items.map((d) => d[valueKey]), 1);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item[labelKey]} className="flex items-center gap-3">
          <span
            className="text-sm w-36 truncate text-right"
            title={item[labelKey]}
          >
            {item[labelKey]}
          </span>
          <div
            className="flex-1 h-6 rounded overflow-hidden"
            style={{ backgroundColor: "#f0e6d9" }}
          >
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${(item[valueKey] / max) * 100}%`,
                backgroundColor: BAR_COLOURS[i % BAR_COLOURS.length],
              }}
            />
          </div>
          <span className="text-sm font-medium w-8 text-right">
            {item[valueKey]}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm opacity-50 italic">no data yet</p>
      )}
    </div>
  );
}

function Sparkline({
  data,
  colour = COLOURS.redwood,
}: {
  data: { month: string; count: number }[];
  colour?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm opacity-50 italic">no data yet</p>;
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div
          key={d.month}
          className="flex-1 flex flex-col items-center gap-1"
        >
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

/* ------------------------------------------------------------------ */
/*  deployment cards                                                   */
/* ------------------------------------------------------------------ */

function DeploymentCards({ deployments }: { deployments: DeploymentInfo[] }) {
  if (deployments.length === 0) {
    return (
      <p className="text-sm opacity-50 italic">
        no deployment data — set VERCEL_ACCESS_TOKEN to enable
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {deployments.map((d) => {
        const style = DEPLOY_STATE_STYLES[d.state] ?? DEPLOY_STATE_STYLES.ERROR;
        return (
          <div
            key={d.app}
            className="rounded-xl p-4 border"
            style={{ borderColor: "#e8ddd0", backgroundColor: "#fffbf5" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: COLOURS.cadet }}>
                {d.app}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {d.state.toLowerCase()}
              </span>
            </div>
            {d.commitMessage && (
              <p className="text-xs opacity-50 truncate" title={d.commitMessage}>
                {d.commitMessage}
              </p>
            )}
            <div className="flex items-center justify-between mt-2">
              {d.commitRef && (
                <span className="text-xs opacity-40 font-mono">{d.commitRef.slice(0, 20)}</span>
              )}
              <span className="text-xs opacity-40">{formatDeployAge(d.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  recent purchases table                                             */
/* ------------------------------------------------------------------ */

function RecentPurchasesTable({
  purchases,
}: {
  purchases: RevenueStats["recentPurchases"];
}) {
  if (purchases.length === 0) {
    return <p className="text-sm opacity-50 italic">no purchases yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-50">
            <th className="pb-2 pr-4 font-medium">pack</th>
            <th className="pb-2 pr-4 font-medium text-right">amount</th>
            <th className="pb-2 font-medium text-right">date</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "#e8ddd0" }}>
          {purchases.map((p, i) => (
            <tr key={`${p.createdAt}-${i}`}>
              <td className="py-2 pr-4">{p.pack}</td>
              <td className="py-2 pr-4 text-right font-medium">
                {formatCents(p.amountCents, p.currency)}
              </td>
              <td className="py-2 text-right opacity-50">
                {new Date(p.createdAt).toLocaleDateString("en-AU", {
                  month: "short",
                  day: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  freshness table                                                    */
/* ------------------------------------------------------------------ */

function formatAge(isoString: string | null): { text: string; stale: boolean } {
  if (!isoString) return { text: "never synced", stale: true };

  const date = new Date(isoString);
  const now = new Date();
  const hoursAgo = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );

  if (hoursAgo < 1) return { text: "< 1 hour ago", stale: false };
  if (hoursAgo < 24) return { text: `${hoursAgo}h ago`, stale: false };

  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo === 1) return { text: "1 day ago", stale: false };
  if (daysAgo <= 3) return { text: `${daysAgo} days ago`, stale: false };

  return { text: `${daysAgo} days ago`, stale: true };
}

function FreshnessTable({ data }: { data: ContentFreshness[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-50">
            <th className="pb-2 pr-4 font-medium">table</th>
            <th className="pb-2 pr-4 font-medium text-right">rows</th>
            <th className="pb-2 font-medium text-right">last sync</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "#e8ddd0" }}>
          {data.map((row) => {
            const age = formatAge(row.lastUpdated);
            return (
              <tr key={row.table}>
                <td className="py-2 pr-4">{row.table}</td>
                <td className="py-2 pr-4 text-right font-medium">
                  {row.rowCount}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      age.stale
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        age.stale ? "bg-red-500" : "bg-green-500"
                      }`}
                    />
                    {age.text}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  main component                                                     */
/* ------------------------------------------------------------------ */

export default function HarborStatusDashboard() {
  const [data, setData] = useState<HarborStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/admin/harbor-status"))
      .then(async (res) => {
        if (!res.ok) throw new Error("failed to load harbor status");
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
          style={{
            borderColor: COLOURS.champagne,
            borderTopColor: COLOURS.redwood,
          }}
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

  const userDelta = data.users.activeUsersThisMonth - data.users.activeUsersLastMonth;
  const userDeltaLabel =
    userDelta > 0
      ? `+${userDelta} from last month`
      : userDelta < 0
        ? `${userDelta} from last month`
        : "same as last month";

  const runDelta = data.runs.runsThisMonth - data.runs.runsLastMonth;
  const runDeltaLabel =
    runDelta > 0
      ? `+${runDelta} from last month`
      : runDelta < 0
        ? `${runDelta} from last month`
        : "same as last month";

  const revDelta = data.revenue.revenueThisMonthCents - data.revenue.revenueLastMonthCents;
  const revDeltaLabel =
    revDelta > 0
      ? `+${formatCents(revDelta)} from last month`
      : revDelta < 0
        ? `${formatCents(revDelta)} from last month`
        : "same as last month";

  return (
    <div className="space-y-12">
      {/* ── content inventory ────────────────────────────────────── */}
      <section>
        <SectionHeading>content inventory</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="playdates" value={data.content.playdates} />
          <StatCard label="materials" value={data.content.materials} />
          <StatCard label="vault activities" value={data.content.vaultActivities} />
          <StatCard label="packs" value={data.content.packs} />
          <StatCard label="cms pages" value={data.content.cmsPages} />
          <StatCard label="collections" value={data.content.collections} />
        </div>
      </section>

      {/* ── users & orgs ─────────────────────────────────────────── */}
      <section>
        <SectionHeading>users & organisations</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="total users" value={data.users.totalUsers} />
          <StatCard label="organisations" value={data.users.totalOrgs} />
          <StatCard
            label="active this month"
            value={data.users.activeUsersThisMonth}
            subtitle={userDeltaLabel}
          />
          <StatCard
            label="signups this month"
            value={data.users.signupsThisMonth}
          />
        </div>

        {/* signup trend */}
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: COLOURS.cadet }}
        >
          signup trend (6 months)
        </h3>
        <Sparkline data={data.recentSignups} colour={COLOURS.sienna} />
      </section>

      {/* ── entitlements & purchases ─────────────────────────────── */}
      <section>
        <SectionHeading>entitlements & purchases</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="active entitlements"
            value={data.entitlements.activeEntitlements}
            subtitle={`${data.entitlements.orgEntitlements} org · ${data.entitlements.userEntitlements} individual`}
          />
          <StatCard
            label="total purchases"
            value={data.entitlements.totalPurchases}
          />
          <StatCard
            label="purchases this month"
            value={data.entitlements.revenueThisMonth}
          />
        </div>
      </section>

      {/* ── reflection activity ───────────────────────────────────── */}
      <section>
        <SectionHeading>reflection activity</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="total reflections" value={data.runs.totalRuns} />
          <StatCard
            label="this month"
            value={data.runs.runsThisMonth}
            subtitle={runDeltaLabel}
          />
          <StatCard
            label="unique reflectors"
            value={data.runs.uniqueReflectors}
          />
          <StatCard
            label="avg per user"
            value={data.runs.avgRunsPerUser}
          />
        </div>

        {/* top playdates */}
        {data.topPlaydates.length > 0 && (
          <>
            <h3
              className="text-sm font-medium mb-3"
              style={{ color: COLOURS.cadet }}
            >
              most-reflected playdates
            </h3>
            <HorizontalBar
              items={data.topPlaydates}
              labelKey="name"
              valueKey="count"
            />
          </>
        )}
      </section>

      {/* ── vault catalog ─────────────────────────────────────────── */}
      {data.topVaultActivities.length > 0 && (
        <section>
          <SectionHeading>vault catalog</SectionHeading>
          <p className="text-sm opacity-50 mb-4">
            {data.content.vaultActivities} activities in the vault
          </p>
          <div className="flex flex-wrap gap-2">
            {data.topVaultActivities.map((a) => (
              <span
                key={a.name}
                className="inline-flex px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "#f0e6d9",
                  color: COLOURS.cadet,
                }}
              >
                {a.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── revenue & purchases ───────────────────────────────────── */}
      <section>
        <SectionHeading>revenue & purchases</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="total revenue"
            value={formatCents(data.revenue.totalRevenueCents)}
          />
          <StatCard
            label="this month"
            value={formatCents(data.revenue.revenueThisMonthCents)}
            subtitle={revDeltaLabel}
          />
          <StatCard
            label="last month"
            value={formatCents(data.revenue.revenueLastMonthCents)}
          />
          <StatCard
            label="avg order"
            value={formatCents(data.revenue.avgOrderCents)}
          />
        </div>

        {/* revenue trend */}
        {data.revenue.revenueTrend.length > 0 && (
          <div className="mb-8">
            <h3
              className="text-sm font-medium mb-3"
              style={{ color: COLOURS.cadet }}
            >
              revenue trend (6 months)
            </h3>
            <Sparkline
              data={data.revenue.revenueTrend.map((t) => ({
                month: t.month,
                count: t.revenueCents,
              }))}
              colour={COLOURS.redwood}
            />
          </div>
        )}

        {/* revenue by pack */}
        {data.revenue.purchasesByPack.length > 0 && (
          <div className="mb-8">
            <h3
              className="text-sm font-medium mb-3"
              style={{ color: COLOURS.cadet }}
            >
              revenue by pack
            </h3>
            <HorizontalBar
              items={data.revenue.purchasesByPack}
              labelKey="name"
              valueKey="count"
            />
          </div>
        )}

        {/* recent purchases */}
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: COLOURS.cadet }}
        >
          recent purchases
        </h3>
        <RecentPurchasesTable purchases={data.revenue.recentPurchases} />
      </section>

      {/* ── deployment health ──────────────────────────────────────── */}
      <section>
        <SectionHeading>deployment health</SectionHeading>
        <DeploymentCards deployments={data.deployments} />
      </section>

      {/* ── content freshness ─────────────────────────────────────── */}
      <section>
        <SectionHeading>content freshness (notion sync)</SectionHeading>
        <FreshnessTable data={data.freshness} />
      </section>
    </div>
  );
}
