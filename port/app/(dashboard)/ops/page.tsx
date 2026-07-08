/**
 * /ops — Opsy's health dashboard (docs/opsy/posture.md §4: zoom out, zoom in).
 *
 * Server component, same conventions as /strategy and /carl: direct
 * lib/supabase + lib/opsy calls in Promise.all with graceful fallbacks; auth
 * is enforced by the (dashboard) layout.
 */

import { Activity, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { buildHealthRollup, getSparklineSeries, type HealthRollup, type Light } from "@/lib/opsy/rollup";
import { SERVICES } from "@/lib/opsy/services";
import {
  getOpsyMemory,
  getOpsyPatterns,
  getRecentAutoFixes,
  getRecentCronFailures,
} from "@/lib/supabase/opsy";
import { getUsageSummary } from "@/lib/ai/usage-store";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { Sparkline } from "./components/sparkline";
import { ArchitectureMap } from "./components/architecture-map";

export const dynamic = "force-dynamic";

const OPS_TABS: readonly TabDef[] = [
  { key: "overview", label: "overview" },
  { key: "architecture", label: "architecture" },
];

const LIGHT_DOT: Record<Light, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  unknown: "bg-muted-foreground/40",
};

const LIGHT_TEXT: Record<Light, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  unknown: "text-muted-foreground",
};

// the posture's zoom-out cards, in display order
const PLATFORM_CARDS: Array<{ key: string; label: string }> = [
  { key: "website", label: "website" },
  { key: "harbour", label: "harbour" },
  { key: "nordic", label: "nordic" },
  { key: "port", label: "port" },
  { key: "data", label: "data layer" },
  { key: "external", label: "external" },
  { key: "security", label: "security" },
];

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-muted text-muted-foreground",
};

// crons opsy knows fire sub-hourly (the grid's row set; failures come from opsy_cron_runs)
const WATCHED_CRONS = [
  "/api/cron/opsy-health-check-t1",
  "/api/cron/opsy-health-check-t2",
  "/api/cron/opsy-health-check-t3",
  "/api/cron/opsy-health-check-t4",
  "/api/cron/opsy-email-scan",
  "/api/cron/sweep-stuck-proposals",
];

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** worst hourly p95 across a platform's member services, oldest → newest */
function platformSeries(
  rollup: HealthRollup,
  series: Map<string, Array<{ bucket: string; p95_ms: number | null }>>,
  platform: string,
): Array<number | null> {
  const members = SERVICES.filter((s) => s.platform === platform).map((s) => s.id);
  const byBucket = new Map<string, number>();
  for (const m of members) {
    for (const b of series.get(m) ?? []) {
      if (b.p95_ms === null) continue;
      byBucket.set(b.bucket, Math.max(byBucket.get(b.bucket) ?? 0, b.p95_ms));
    }
  }
  return [...byBucket.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab = OPS_TABS.find((t) => t.key === tabParam)?.key ?? "overview";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [rollup, series, autoFixes, patterns, memory, cronFailures, usage] = await Promise.all([
    buildHealthRollup().catch(() => null),
    getSparklineSeries(168).catch(() => new Map()),
    getRecentAutoFixes(7).catch(() => []),
    getOpsyPatterns().catch(() => []),
    getOpsyMemory().catch(() => []),
    getRecentCronFailures(7).catch(() => []),
    getUsageSummary(monthStart, now.toISOString()).catch(() => null),
  ]);

  const incidents = rollup?.incidents_7d ?? [];
  const openIncidents = incidents.filter((i) => i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");
  const failuresByPath = new Map<string, typeof cronFailures>();
  for (const f of cronFailures) {
    const list = failuresByPath.get(f.path) ?? [];
    list.push(f);
    failuresByPath.set(f.path, list);
  }
  const opsyAiCost =
    (usage?.byFeature["opsy-email-triage"]?.costUsd ?? 0) +
    (usage?.byFeature["opsy-digest"]?.costUsd ?? 0);

  // live design-token drift status → feeds the architecture map's token-flow panel
  const tokenSvc = rollup?.services["design-token-sync"];
  const tokenSync = tokenSvc
    ? { status: tokenSvc.status, detail: tokenSvc.last_check ? `checked ${relTime(tokenSvc.last_check)}` : null, lastCheck: tokenSvc.last_check }
    : undefined;

  return (
    <>
      <PageHeader
        title="ops"
        description={`Opsy · operations + systems intelligence · last check ${relTime(rollup?.last_check ?? null)}`}
      />

      <UrlTabs tabs={OPS_TABS} activeTab={activeTab} />

      {activeTab === "architecture" && <ArchitectureMap tokenSync={tokenSync} />}

      {activeTab === "overview" && (
      <div className="space-y-6">
        {/* ── zoom out: platform cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {PLATFORM_CARDS.map(({ key, label }) => {
            const p = rollup?.platforms[key];
            const status = (p?.status ?? "unknown") as Light;
            return (
              <div key={key} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_DOT[status]}`} />
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums">
                  {p?.uptime_24h !== null && p?.uptime_24h !== undefined ? `${p.uptime_24h}%` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  p95 {p?.p95_ms_24h ?? "—"}ms · {p?.incidents_7d ?? 0} incidents 7d
                </p>
                <div className={`mt-1 ${LIGHT_TEXT[status]}`}>
                  <Sparkline values={rollup ? platformSeries(rollup, series, key) : []} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── zoom in: services table ──────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">services</h2>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(rollup?.services ?? {}).map(([id, s]) => (
              <div key={id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${LIGHT_DOT[s.status as Light]}`} />
                <span className="w-44 shrink-0 font-medium">{id}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline w-24">tier {s.tier}</span>
                <span className="w-24 tabular-nums text-xs text-muted-foreground">
                  {s.response_time_ms !== null ? `${s.response_time_ms}ms` : "awaiting"}
                </span>
                <span className="hidden w-24 tabular-nums text-xs text-muted-foreground md:inline">
                  {s.uptime_24h !== null ? `${s.uptime_24h}% 24h` : "—"}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">{relTime(s.last_check)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── incidents + auto-fixes + patterns ────────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card lg:col-span-2">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">incidents (7 days)</h2>
            </div>
            <div className="divide-y divide-border">
              {incidents.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">none — all clear</p>
              )}
              {[...openIncidents, ...resolvedIncidents].slice(0, 12).map((i) => (
                <div key={i.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[i.severity]}`}>
                      {i.severity}
                    </span>
                    <span className="text-sm font-medium">{i.service}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {i.status} · {relTime(i.opened_at)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.symptoms}</p>
                  {i.remediation && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      → {i.remediation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium">auto-fixes (7 days)</h2>
              </div>
              <div className="divide-y divide-border">
                {autoFixes.length === 0 && (
                  <p className="px-4 py-4 text-sm text-muted-foreground">none needed</p>
                )}
                {autoFixes.slice(0, 6).map((f) => (
                  <div key={f.id} className="flex items-start gap-2 px-4 py-2 text-xs">
                    <span>{f.result === "success" ? "✓" : f.result === "partial" ? "◐" : "✗"}</span>
                    <span className="text-muted-foreground">{f.action}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {relTime(f.executed_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium">learned patterns</h2>
              </div>
              <div className="divide-y divide-border">
                {patterns.length === 0 && (
                  <p className="px-4 py-4 text-sm text-muted-foreground">nothing recurring yet</p>
                )}
                {patterns.slice(0, 4).map((p) => (
                  <div key={p.id} className="px-4 py-2">
                    <p className="text-xs font-medium">
                      {p.services.join(", ")} <span className="text-muted-foreground">× {p.occurrence_count}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {p.recommendation ?? p.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── cron grid + costs + memory ───────────────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">cron health (7 days)</h2>
            </div>
            <div className="divide-y divide-border">
              {WATCHED_CRONS.map((path) => {
                const fails = failuresByPath.get(path) ?? [];
                const label = path.replace("/api/cron/", "");
                return (
                  <div key={path} className="flex items-center gap-2 px-4 py-2 text-xs">
                    <span
                      className={`h-2 w-2 rounded-full ${fails.length === 0 ? "bg-emerald-500" : fails.some((f) => !f.retry_ok) ? "bg-red-500" : "bg-amber-500"}`}
                    />
                    <span className="font-medium">{label}</span>
                    <span className="ml-auto text-muted-foreground">
                      {fails.length === 0
                        ? "no failures"
                        : `${fails.length} failure${fails.length > 1 ? "s" : ""}, ${fails.filter((f) => f.retry_ok).length} auto-recovered`}
                    </span>
                  </div>
                );
              })}
              {[...failuresByPath.keys()]
                .filter((p) => !WATCHED_CRONS.includes(p))
                .map((path) => {
                  const fails = failuresByPath.get(path)!;
                  return (
                    <div key={path} className="flex items-center gap-2 px-4 py-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${fails.some((f) => !f.retry_ok) ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="font-medium">{path.replace("/api/cron/", "")}</span>
                      <span className="ml-auto text-muted-foreground">
                        {fails.length} failure{fails.length > 1 ? "s" : ""}, {fails.filter((f) => f.retry_ok).length} auto-recovered
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">cost tracking</h2>
            </div>
            <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">
              <p>
                opsy AI spend this month:{" "}
                <span className="font-medium text-foreground">${opsyAiCost.toFixed(2)}</span>
              </p>
              <p>
                infrastructure spend (cloudflare, vercel, supabase): awaiting billing credentials — unlocks
                with <code className="text-[10px]">CLOUDFLARE_API_TOKEN</code> /{" "}
                <code className="text-[10px]">VERCEL_API_TOKEN</code> in phase 2.5.
              </p>
              <Link
                href="/ai-hub"
                className="flex items-center gap-2 text-sm font-medium p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors mt-3 text-foreground"
              >
                <Sparkles className="h-4 w-4 text-violet-500" />
                open AI hub
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" /> opsy&apos;s working state
              </h2>
            </div>
            <div className="divide-y divide-border">
              {memory.map((m) => (
                <div key={m.key} className="px-4 py-2">
                  <p className="text-[11px] font-medium">{m.key}</p>
                  <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
