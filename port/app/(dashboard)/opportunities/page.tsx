import { Suspense } from "react";
import Link from "next/link";
import { getDealsFromSupabase } from "@/lib/supabase/deals";
import { getOrganizationByIdFromSupabase } from "@/lib/supabase/organizations";
import { getRfpOpportunitiesFromSupabase, getRfpOpportunityByIdFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { DealKanban } from "@/app/components/deal-kanban";
import { RfpKanban } from "@/app/components/rfp-kanban";
import { SyncFeedsButton } from "@/app/components/sync-feeds-button";
import { RfpHowItWorks } from "@/app/components/rfp-how-it-works";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KanbanSkeleton, StatsStripSkeleton } from "@/app/components/skeletons";
import type { RfpOpportunity } from "@/lib/notion/types";
import type { RfpOpportunitySupabaseFilters } from "@/lib/supabase/rfp-opportunities";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "rfps", label: "RFP lighthouse" },
  { key: "deals", label: "deals" },
];

const RFP_TYPE_OPTIONS = [
  "RFP", "RFQ", "RFI", "Grant", "EOI", "Cold Lead",
  "Warm Intro", "Conference Contact", "Direct Outreach",
] as const;

const FIT_OPTIONS = ["high fit", "medium fit", "low fit", "TBD"] as const;

const RFP_SOURCE_OPTIONS = [
  "RFP Platform", "Google Alert", "RSS Feed", "Cold Research",
  "Conference", "Direct Network", "Partner Referral", "Email Alert", "Manual Entry",
] as const;

const RFP_STATUS_OPTIONS = [
  "radar", "reviewing", "pursuing", "interviewing", "submitted",
  "won", "lost", "no-go", "missed deadline",
] as const;

const ACTIVE_STATUSES = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** Replicates computeWinProbability (ai-win-probability.tsx) server-side — pure formula, no API call. */
function serverComputeWinProbability(rfp: RfpOpportunity): number {
  let score = 30;
  if (rfp.wvFitScore === "high fit") score += 25;
  else if (rfp.wvFitScore === "medium fit") score += 10;
  else if (rfp.wvFitScore === "low fit") score -= 10;
  if (rfp.serviceMatch.length >= 3) score += 15;
  else if (rfp.serviceMatch.length >= 1) score += 5;
  if (rfp.status === "interviewing") score += 15;
  else if (rfp.status === "submitted") score += 10;
  else if (rfp.status === "pursuing") score += 5;
  if (rfp.estimatedValue && rfp.estimatedValue > 500_000) score -= 5;
  return Math.max(5, Math.min(95, score));
}

// ── deals board ──────────────────────────────────────────────

interface BoardProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function DealsBoard({ searchParams }: BoardProps) {
  const params = await searchParams;

  const deals = await getDealsFromSupabase(undefined, undefined, params.search);

  const uniqueOrgIds = [...new Set(deals.flatMap((d) => d.organizationIds))].slice(0, 30);
  const orgEntries = await Promise.all(
    uniqueOrgIds.map(async (id) => {
      try {
        const org = await getOrganizationByIdFromSupabase(id);
        return [id, org?.organization ?? ""] as const;
      } catch {
        return [id, ""] as const;
      }
    }),
  );
  const orgNames = Object.fromEntries(orgEntries);

  const uniqueRfpIds = [...new Set(deals.flatMap((d) => d.rfpOpportunityIds))].slice(0, 30);
  const rfpEntries = await Promise.all(
    uniqueRfpIds.map(async (id) => {
      const rfp = await getRfpOpportunityByIdFromSupabase(id);
      return rfp ? [id, rfp] as const : null;
    }),
  );
  const rfpMap: Record<string, RfpOpportunity> = Object.fromEntries(
    rfpEntries.filter((e): e is NonNullable<typeof e> => e !== null),
  );

  return <DealKanban deals={deals} orgNames={orgNames} rfpMap={rfpMap} />;
}

// ── RFP board ────────────────────────────────────────────────

async function RfpBoard({ searchParams }: BoardProps) {
  const params = await searchParams;
  const filters: RfpOpportunitySupabaseFilters = {};
  if (params.opportunityType) filters.opportunityType = params.opportunityType;
  if (params.wvFitScore) filters.wvFitScore = params.wvFitScore;
  if (params.source) filters.source = params.source;
  if (params.status) filters.status = params.status;
  if (params.search) filters.search = params.search;

  const { data: rfps } = await getRfpOpportunitiesFromSupabase(
    filters,
    { pageSize: 100 },
  );

  const activeRfps = rfps.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const completedRfps = rfps.filter((r) => !ACTIVE_STATUSES.includes(r.status));

  const totalValue = activeRfps.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);
  const wonValue = completedRfps
    .filter((r) => r.status === "won")
    .reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);

  const weightedPipeline = activeRfps
    .filter((r) => r.estimatedValue != null && r.estimatedValue > 0)
    .reduce((sum, r) => sum + (r.estimatedValue! * serverComputeWinProbability(r)) / 100, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{activeRfps.length}</p>
            <p className="text-xs text-muted-foreground">active pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-muted-foreground">pipeline value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {completedRfps.filter((r) => r.status === "won").length}
            </p>
            <p className="text-xs text-muted-foreground">won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{formatCurrency(wonValue)}</p>
            <p className="text-xs text-muted-foreground">revenue won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{formatCurrencyCompact(weightedPipeline)}</p>
            <p className="text-xs text-muted-foreground">weighted pipeline</p>
          </CardContent>
        </Card>
      </div>

      <RfpKanban opportunities={rfps} />

      {completedRfps.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            completed ({completedRfps.length})
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>opportunity</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>value</TableHead>
                  <TableHead>decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedRfps.map((rfp) => (
                  <TableRow key={rfp.id} className="text-muted-foreground">
                    <TableCell className="font-medium">{rfp.opportunityName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          rfp.status === "won" ? "bg-green-100 text-green-700 border-green-200" :
                          rfp.status === "lost" ? "bg-red-100 text-red-700 border-red-200" :
                          rfp.status === "no-go" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          rfp.status === "missed deadline" ? "bg-slate-100 text-slate-500 border-slate-200" :
                          "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {rfp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{rfp.opportunityType}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(rfp.estimatedValue)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{rfp.decisionNotes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}

// ── main page ────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function OpportunitiesPage(props: Props) {
  const params = await props.searchParams;
  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "rfps";

  return (
    <>
      <PageHeader
        title="opportunities"
        description="track deals and RFP opportunities from discovery to close"
      >
        {activeTab === "rfps" && <SyncFeedsButton />}
      </PageHeader>

      <Suspense>
        <UrlTabs tabs={TABS} activeTab={activeTab} />
      </Suspense>

      {activeTab === "deals" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Suspense>
              <SearchInput placeholder="search deals..." />
            </Suspense>
          </div>
          <Suspense fallback={<KanbanSkeleton columnCount={5} />}>
            <DealsBoard searchParams={props.searchParams} />
          </Suspense>
        </>
      )}

      {activeTab === "rfps" && (
        <>
          <div className="mb-4 flex items-center gap-4">
            <Link
              href="/rfp-radar/deadlines"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              view deadlines →
            </Link>
            <Link
              href="/rfp-radar/feeds"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              manage feed sources →
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Suspense>
              <SearchInput placeholder="search opportunities..." />
              <FilterSelect paramKey="opportunityType" placeholder="type" options={RFP_TYPE_OPTIONS} />
              <FilterSelect paramKey="wvFitScore" placeholder="fit" options={FIT_OPTIONS} />
              <FilterSelect paramKey="source" placeholder="source" options={RFP_SOURCE_OPTIONS} />
              <FilterSelect paramKey="status" placeholder="status" options={RFP_STATUS_OPTIONS} />
            </Suspense>
          </div>
          <RfpHowItWorks />
          <Suspense fallback={<><StatsStripSkeleton /><KanbanSkeleton columnCount={5} /></>}>
            <RfpBoard searchParams={props.searchParams} />
          </Suspense>
        </>
      )}
    </>
  );
}
