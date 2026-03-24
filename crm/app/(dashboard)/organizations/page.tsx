import { Suspense } from "react";
import { queryOrganizations } from "@/lib/notion/organizations";
import { ClickableRow } from "@/app/components/clickable-row";
import { PageHeader } from "@/app/components/page-header";
import { StatusBadge } from "@/app/components/status-badge";
import { PriorityBadge, FitBadge } from "@/app/components/priority-badge";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationFilters } from "@/lib/notion/types";

export const revalidate = 300;

const CONNECTION_OPTIONS = [
  "unengaged", "exploring", "in progress", "collaborating", "champion", "steward", "past client",
] as const;

const OUTREACH_OPTIONS = [
  "Not started", "Researching", "Contacted", "In conversation", "Proposal sent", "Active client",
] as const;

const PRIORITY_OPTIONS = [
  "Tier 1 – Pursue now", "Tier 2 – Warm up", "Tier 3 – Monitor",
] as const;

const TYPE_OPTIONS = [
  "ngo", "studio", "corporate", "non-profit", "foundation", "government",
  "individual donor", "consultancy/firm", "academic institution",
] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function OrganizationsTable({ searchParams }: Props) {
  const params = await searchParams;
  const filters: OrganizationFilters = {};
  if (params.connection) filters.connection = params.connection as OrganizationFilters["connection"];
  if (params.outreachStatus) filters.outreachStatus = params.outreachStatus as OrganizationFilters["outreachStatus"];
  if (params.type) filters.type = params.type as OrganizationFilters["type"];
  if (params.priority) filters.priority = params.priority as OrganizationFilters["priority"];
  if (params.search) filters.search = params.search;

  const { data: organizations } = await queryOrganizations(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 100 },
  );

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No organizations found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Organization</TableHead>
            <TableHead>Connection</TableHead>
            <TableHead>Outreach</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Fit</TableHead>
            <TableHead>Segment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <ClickableRow key={org.id} href={`/organizations/${org.id}`}>
              <TableCell className="font-medium">
                {org.organization}
              </TableCell>
              <TableCell>
                <StatusBadge value={org.connection} type="connection" />
              </TableCell>
              <TableCell>
                <StatusBadge value={org.outreachStatus} type="outreach" />
              </TableCell>
              <TableCell>
                {org.type && (
                  <Badge variant="outline" className="text-xs">
                    {org.type}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <PriorityBadge value={org.priority} />
              </TableCell>
              <TableCell>
                <FitBadge value={org.fitRating} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                {org.marketSegment}
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function OrganizationsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="Organizations"
        description={`Browse and filter all organizations in the pipeline`}
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="Search organizations..." />
          <FilterSelect paramKey="connection" placeholder="Connection" options={CONNECTION_OPTIONS} />
          <FilterSelect paramKey="outreachStatus" placeholder="Outreach" options={OUTREACH_OPTIONS} />
          <FilterSelect paramKey="type" placeholder="Type" options={TYPE_OPTIONS} />
          <FilterSelect paramKey="priority" placeholder="Priority" options={PRIORITY_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">Loading...</div>}>
        <OrganizationsTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
