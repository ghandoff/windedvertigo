import { Suspense } from "react";
import Link from "next/link";
import { queryDeals } from "@/lib/notion/deals";
import { getOrganization } from "@/lib/notion/organizations";
import { queryRfpOpportunities, getRfpOpportunity } from "@/lib/notion/rfp-radar";
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
import type { DealFilters, RfpFilters, RfpOpportunity } from "@/lib/notion/types";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "deals", label: "deals" },
  { key: "rfps", label: "RFP lighthouse" },
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

// ── deals board ──────────────────────────────────────────────

interface BoardProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function DealsBoard({ searchParams }: BoardProps) {
  const params = await searchParams;
  const filters: DealFilters = {};
  if (params.search) filters.search = params.search;

  const { data: deals } = await queryDeals(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 200 },
  );

  const uniqueOrgIds = [...new Set(deals.flatMap((d) => d.organizationIds))].slice(0, 30);
  const orgEntries = await Promise.all(
    uniqueOrgIds.map(async (id) => {
      try {
        const org = await getOrganization(id);
        return [id, org.organization] as const;
      } catch {
        return [id, ""] as const;
      }
    }),
  );
  const orgNames = Object.fromEntries(orgEntries);

  const uniqueRfpIds = [...new Set(deals.flatMap((d) => d.rfpOpportunityIds))].slice(0, 30);
  const rfpEntries = await Promise.all(
    uniqueRfpIds.map(async (id) => {
      try {
        const rfp = await getRfpOpportunity(id);
        return [id, rfp] as const;
      } catch {
        return null;
      }
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
  const filters: RfpFilters = {};
  if (params.opportunityType) filters.opportunityType = params.opportunityType as RfpFilters["opportunityType"];
  if (params.wvFitScore) filters.wvFitScore = params.wvFitScore as RfpFilters["wvFitScore"];
  if (params.source) filters.source = params.source as RfpFilters["source"];
  if (params.status) filters.status = params.status as RfpFilters["status"];
  if (params.search) filters.search = params.search;

  const { data: rfps } = await queryRfpOpportunities(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 100 },
  );

  const activeRfps = rfps.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const completedRfps = rfps.filter((r) => !ACTIVE_STATUSES.includes(r.status));

  const totalValue = activeRfps.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);
  const wonValue = completedRfps
    .filter((r) => r.status === "won")
    .reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "deals";

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
