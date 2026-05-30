/**
 * /harbour — harbour analytics dashboard
 *
 * L2 (business metrics) — pure Neon SQL reads over the shared harbour-apps
 * Postgres. No Cloudflare Analytics Engine yet (that's L1, Phase 2).
 *
 * Gated by (dashboard)/layout.tsx — auth is inherited, no re-check needed.
 * Reads ?app= search param for per-app scoping; makes the page dynamic
 * (correct for an internal ops tool — no caching needed for 5 users).
 *
 * ── SECRET REQUIRED ─────────────────────────────────────────────────────────
 * POSTGRES_URL must be set on the wv-port CF Worker:
 *   wrangler secret put POSTGRES_URL --name wv-port
 * The value is the harbour-apps Neon pooled connection string.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { Suspense } from "react";
import { PageHeader } from "@/app/components/page-header";
import {
  getHarbourAnalytics,
  type HarbourAnalytics,
} from "@/lib/neon/harbour-analytics";
import { AppFilter } from "./components/app-filter";
import { BarChart } from "./components/bar-chart";
import { FunnelChart } from "./components/funnel-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Anchor, Users, ShoppingCart, TrendingUp, Zap, AlertCircle } from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  if (cents === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ── stat card ─────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, sub, icon }: StatCard) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex gap-3 items-start">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-foreground leading-none">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── unavailable banner ────────────────────────────────────────────────────────

function UnavailableBanner() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 flex items-start gap-3 text-sm">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-amber-800 dark:text-amber-300">
          harbour analytics unavailable
        </p>
        <p className="text-amber-700 dark:text-amber-400 mt-0.5">
          <code className="font-mono text-xs">POSTGRES_URL</code> is not set on the{" "}
          <code className="font-mono text-xs">wv-port</code> CF Worker. Run:
        </p>
        <pre className="mt-1 text-xs font-mono text-amber-700 dark:text-amber-400">
          wrangler secret put POSTGRES_URL --name wv-port
        </pre>
        <p className="text-xs mt-1 text-amber-600 dark:text-amber-500">
          The value is the harbour-apps Neon pooled connection string (same{" "}
          <code className="font-mono">POSTGRES_URL</code> used by creaseworks).
        </p>
      </div>
    </div>
  );
}

// ── section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function HarbourDashboardContent({ app }: { app?: string }) {
  const data: HarbourAnalytics = await getHarbourAnalytics(app);
  const { summary, userGrowth, packAdoption, funnel, knots, depthChart } = data;

  return (
    <div className="space-y-8">
      {data.unavailable && <UnavailableBanner />}

      {/* ── stat strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="total users"
          value={summary.totalUsers.toLocaleString()}
          sub={`${summary.activeUsersThisMonth} active this month`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={app ? `${app} purchases` : "total purchases"}
          value={summary.totalPurchases.toLocaleString()}
          sub={`${summary.activeEntitlements} active entitlements`}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label={app ? `${app} revenue` : "total revenue"}
          value={formatCurrency(summary.totalRevenueCents)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="knots earned"
          value={knots.totalEarned.toLocaleString()}
          sub={`${knots.totalSpent.toLocaleString()} spent`}
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── user growth ──────────────────────────────────────────── */}
        <Section title="user growth" note="last 12 months — always harbour-wide">
          <div className="rounded-lg border border-border bg-card p-4">
            <BarChart data={userGrowth} />
            <p className="text-xs text-muted-foreground mt-2">
              bars = monthly signups · line = cumulative total
            </p>
          </div>
        </Section>

        {/* ── conversion funnel ────────────────────────────────────── */}
        <Section
          title="conversion funnel"
          note={app ? `scoped to ${app}` : "harbour-wide"}
        >
          <div className="rounded-lg border border-border bg-card p-4">
            <FunnelChart steps={funnel} />
          </div>
        </Section>
      </div>

      {/* ── pack adoption ──────────────────────────────────────────── */}
      <Section
        title="pack adoption"
        note={app ? `showing packs for ${app}` : "all apps"}
      >
        {packAdoption.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            no active entitlements found
            {app ? ` for ${app}` : ""}.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>app</TableHead>
                  <TableHead>pack</TableHead>
                  <TableHead className="text-right">entitlements</TableHead>
                  <TableHead className="text-right">purchases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packAdoption.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.app}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.packTitle}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.entitlementCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.purchaseCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── knots economy ──────────────────────────────────────────── */}
      <Section
        title="knots economy"
        note="always harbour-wide (engagement ledger has no app dimension)"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {knots.byReason.slice(0, 4).map((r) => (
            <div
              key={r.reason}
              className="rounded-lg border border-border bg-card px-3 py-2"
            >
              <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">
                {r.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        {knots.byReason.length === 0 && (
          <p className="text-sm text-muted-foreground">
            no knots activity yet.
          </p>
        )}
      </Section>

      {/* ── depth-chart usage ──────────────────────────────────────── */}
      {(!app || app === "depth-chart") && (
        <Section
          title="depth.chart usage"
          note="assessment generator telemetry"
        >
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="plans created"
              value={depthChart.plansCreated.toLocaleString()}
              icon={<Anchor className="h-4 w-4" />}
            />
            <StatCard
              label="tasks generated"
              value={depthChart.tasksGenerated.toLocaleString()}
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard
              label="total events"
              value={depthChart.totalEvents.toLocaleString()}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>
        </Section>
      )}

      {/* ── L1 placeholder ─────────────────────────────────────────── */}
      <Section
        title="web analytics (L1)"
        note="coming in phase 2"
      >
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          <p>visitors · sessions · time-on-page · traffic per app</p>
          <p className="mt-1 text-xs">
            phase 2: add{" "}
            <code className="font-mono">HARBOUR_ANALYTICS</code> binding to each
            CF Worker and redeploy ~18 apps to start emitting to{" "}
            <code className="font-mono">harbour_web</code> Analytics Engine.
          </p>
        </div>
      </Section>
    </div>
  );
}

export default async function HarbourPage({ searchParams }: Props) {
  const params = await searchParams;
  const app = params.app ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="harbour analytics">
        <Suspense>
          <AppFilter />
        </Suspense>
      </PageHeader>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg border bg-muted" />
            ))}
          </div>
        }
      >
        <HarbourDashboardContent app={app} />
      </Suspense>
    </div>
  );
}
