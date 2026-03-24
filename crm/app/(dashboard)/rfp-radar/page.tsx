import { Suspense } from "react";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { RfpKanban } from "@/app/components/rfp-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { RfpFilters } from "@/lib/notion/types";

export const revalidate = 300;

const TYPE_OPTIONS = [
  "RFP", "RFQ", "RFI", "Grant", "EOI", "Cold Lead",
  "Warm Intro", "Conference Contact", "Direct Outreach",
] as const;

const FIT_OPTIONS = ["high fit", "medium fit", "low fit", "TBD"] as const;

const SOURCE_OPTIONS = [
  "RFP Platform", "Google Alert", "RSS Feed", "Cold Research",
  "Conference", "Direct Network", "Partner Referral", "Email Alert", "Manual Entry",
] as const;

const ACTIVE_STATUSES = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function RfpBoard({ searchParams }: Props) {
  const params = await searchParams;
  const filters: RfpFilters = {};
  if (params.opportunityType) filters.opportunityType = params.opportunityType as RfpFilters["opportunityType"];
  if (params.wvFitScore) filters.wvFitScore = params.wvFitScore as RfpFilters["wvFitScore"];
  if (params.source) filters.source = params.source as RfpFilters["source"];
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
      {/* summary stats */}
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

      {/* draggable kanban board */}
      <RfpKanban opportunities={rfps} />

      {/* completed section */}
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

export default async function RfpRadarPage(props: Props) {
  return (
    <>
      <PageHeader
        title="RFP radar"
        description="track opportunities from discovery through submission to outcome"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search opportunities..." />
          <FilterSelect paramKey="opportunityType" placeholder="type" options={TYPE_OPTIONS} />
          <FilterSelect paramKey="wvFitScore" placeholder="fit" options={FIT_OPTIONS} />
          <FilterSelect paramKey="source" placeholder="source" options={SOURCE_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
        <RfpBoard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
