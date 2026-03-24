import { Suspense } from "react";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarDays, DollarSign, ExternalLink } from "lucide-react";
import type { RfpOpportunity, RfpFilters } from "@/lib/notion/types";

export const revalidate = 300;

const STATUS_COLUMNS = [
  { key: "radar", label: "Radar", color: "bg-blue-500" },
  { key: "reviewing", label: "Reviewing", color: "bg-yellow-500" },
  { key: "pursuing", label: "Pursuing", color: "bg-orange-500" },
  { key: "submitted", label: "Submitted", color: "bg-purple-500" },
] as const;

const FIT_COLORS: Record<string, string> = {
  "high fit": "bg-green-100 text-green-700 border-green-200",
  "medium fit": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "low fit": "bg-gray-100 text-gray-600 border-gray-200",
  "TBD": "bg-blue-50 text-blue-600 border-blue-200",
};

const TYPE_OPTIONS = [
  "RFP", "RFQ", "RFI", "Grant", "EOI", "Cold Lead",
  "Warm Intro", "Conference Contact", "Direct Outreach",
] as const;

const FIT_OPTIONS = ["high fit", "medium fit", "low fit", "TBD"] as const;

const SOURCE_OPTIONS = [
  "RFP Platform", "Google Alert", "RSS Feed", "Cold Research",
  "Conference", "Direct Network", "Partner Referral", "Email Alert", "Manual Entry",
] as const;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function RfpCard({ rfp }: { rfp: RfpOpportunity }) {
  const deadlineDays = daysUntil(rfp.dueDate?.start);
  const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7;
  const overdue = deadlineDays !== null && deadlineDays < 0;

  return (
    <Card className={`hover:shadow-md transition-shadow ${deadlineUrgent ? "border-destructive/50" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{rfp.opportunityName}</p>
          {rfp.url && (
            <a href={rfp.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {rfp.opportunityType && (
            <Badge variant="outline" className="text-[10px]">{rfp.opportunityType}</Badge>
          )}
          {rfp.wvFitScore && (
            <Badge variant="outline" className={`text-[10px] ${FIT_COLORS[rfp.wvFitScore] ?? ""}`}>
              {rfp.wvFitScore}
            </Badge>
          )}
        </div>

        {rfp.dueDate?.start && (
          <div className={`flex items-center gap-1.5 text-xs ${overdue ? "text-destructive" : deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            <CalendarDays className="h-3 w-3" />
            <span>
              {overdue ? "Overdue" : formatDate(rfp.dueDate.start)}
              {deadlineDays !== null && deadlineDays >= 0 && ` (${deadlineDays}d)`}
            </span>
          </div>
        )}

        {(rfp.estimatedValue ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>{formatCurrency(rfp.estimatedValue)}</span>
          </div>
        )}

        {rfp.serviceMatch.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rfp.serviceMatch.slice(0, 3).map((s) => (
              <span key={s} className="text-[9px] text-muted-foreground bg-muted px-1 rounded">
                {s}
              </span>
            ))}
            {rfp.serviceMatch.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{rfp.serviceMatch.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
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

  // Active pipeline only (exclude won/lost/no-go/missed)
  const activeRfps = rfps.filter((r) =>
    ["radar", "reviewing", "pursuing", "submitted"].includes(r.status)
  );
  const completedRfps = rfps.filter((r) =>
    ["won", "lost", "no-go", "missed deadline"].includes(r.status)
  );

  const totalValue = activeRfps.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);
  const wonValue = completedRfps
    .filter((r) => r.status === "won")
    .reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);

  return (
    <>
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{activeRfps.length}</p>
            <p className="text-xs text-muted-foreground">Active Pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {completedRfps.filter((r) => r.status === "won").length}
            </p>
            <p className="text-xs text-muted-foreground">Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{formatCurrency(wonValue)}</p>
            <p className="text-xs text-muted-foreground">Revenue Won</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {STATUS_COLUMNS.map((col) => {
          const items = activeRfps.filter((r) => r.status === col.key);
          const colValue = items.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);

          return (
            <div key={col.key} className="flex-shrink-0 w-72 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between px-3 py-2.5 border-b">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.color}`} />
                  <h3 className="text-sm font-medium">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                {colValue > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatCurrency(colValue)}
                  </span>
                )}
              </div>
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="p-2 space-y-2">
                  {items.map((rfp) => (
                    <RfpCard key={rfp.id} rfp={rfp} />
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No opportunities
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {/* Completed section */}
      {completedRfps.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Completed ({completedRfps.length})
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Decision</TableHead>
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
        title="RFP Radar"
        description="Track opportunities from discovery through submission to outcome"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="Search opportunities..." />
          <FilterSelect paramKey="opportunityType" placeholder="Type" options={TYPE_OPTIONS} />
          <FilterSelect paramKey="wvFitScore" placeholder="Fit" options={FIT_OPTIONS} />
          <FilterSelect paramKey="source" placeholder="Source" options={SOURCE_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">Loading...</div>}>
        <RfpBoard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
