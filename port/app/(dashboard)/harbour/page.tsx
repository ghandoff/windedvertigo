/**
 * /harbour — harbour analytics dashboard
 *
 * Two tabs:
 *   command     — operational fleet view (North Stars, DAM/WAM, per-app fleet)
 *   observatory — analytical growth view (Duolingo state buckets, cohorts, leaderboard)
 *
 * Each tab only fetches the data it needs — no cross-tab waterfall.
 * Dynamic rendering (reads searchParams) is correct for an internal ops tool.
 *
 * Gated by (dashboard)/layout.tsx. No auth re-check needed.
 *
 * ── POSTGRES_URL SECRET ────────────────────────────────────────────────────
 * wrangler secret put POSTGRES_URL --name wv-port
 * (harbour-apps Neon pooled connection string, same as creaseworks)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { Suspense } from "react";
import { PageHeader }      from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { AlertCircle }     from "lucide-react";
import { getCommandMetrics } from "@/lib/neon/harbour-command";
import { getHarbourAnalytics } from "@/lib/neon/harbour-analytics";
import { getObservatoryMetrics } from "@/lib/neon/harbour-observatory";
import { CommandTab }      from "./components/command-tab";
import { ObservatoryTab }  from "./components/observatory-tab";
import { AppFilter }       from "./components/app-filter";

// ── tab definitions ───────────────────────────────────────────────────────────

const TABS: TabDef[] = [
  { key: "command",     label: "command" },
  { key: "observatory", label: "observatory" },
];

// ── unavailable banner ────────────────────────────────────────────────────────

function UnavailableBanner({ error }: { error?: string }) {
  const isNotConfigured = !error || error.includes("not set");
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 flex items-start gap-3 text-sm mb-6">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-amber-800 dark:text-amber-300">
          harbour analytics unavailable
        </p>
        {error && (
          <pre className="mt-1 text-xs font-mono text-amber-700 dark:text-amber-400 whitespace-pre-wrap break-all">
            {error}
          </pre>
        )}
        {isNotConfigured && (
          <>
            <p className="text-amber-700 dark:text-amber-400 mt-1">
              run: <code className="font-mono text-xs">wrangler secret put POSTGRES_URL --name wv-port</code>
            </p>
            <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-500">
              value: the harbour-apps Neon pooled connection string (same{" "}
              <code className="font-mono">POSTGRES_URL</code> used by creaseworks).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── tab content (async server components — each fetches only its own data) ────

async function CommandContent() {
  const metrics = await getCommandMetrics();
  return (
    <>
      {metrics.unavailable && <UnavailableBanner error={metrics.error} />}
      <CommandTab metrics={metrics} />
    </>
  );
}

async function ObservatoryContent({ app }: { app?: string }) {
  const [analytics, observatory] = await Promise.all([
    getHarbourAnalytics(app),
    getObservatoryMetrics(app),
  ]);
  const unavailable = analytics.unavailable || observatory.unavailable;
  const error = analytics.error ?? observatory.error;
  return (
    <>
      {unavailable && <UnavailableBanner error={error} />}
      <ObservatoryTab analytics={analytics} observatory={observatory} app={app} />
    </>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-28 rounded-lg bg-muted" />
        <div className="h-28 rounded-lg bg-muted" />
      </div>
      <div className="h-36 rounded-lg bg-muted" />
      <div className="h-48 rounded-lg bg-muted" />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function HarbourPage({ searchParams }: Props) {
  const params  = await searchParams;
  const tab     = (params.tab ?? "command") as "command" | "observatory";
  const app     = params.app;

  return (
    <div className="flex flex-col gap-0">
      <PageHeader title="harbour analytics">
        {tab === "observatory" && (
          <Suspense>
            <AppFilter />
          </Suspense>
        )}
      </PageHeader>

      {/* UrlTabs is a client component — wrap in Suspense for streaming */}
      <Suspense>
        <UrlTabs tabs={TABS} activeTab={tab} />
      </Suspense>

      {tab === "command" && (
        <Suspense fallback={<TabSkeleton />}>
          <CommandContent />
        </Suspense>
      )}

      {tab === "observatory" && (
        <Suspense fallback={<TabSkeleton />}>
          <ObservatoryContent app={app} />
        </Suspense>
      )}
    </div>
  );
}
