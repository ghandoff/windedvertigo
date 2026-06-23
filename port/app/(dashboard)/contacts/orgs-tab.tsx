import { Suspense } from "react";
import { getOrganizationsFromSupabase, type OrganizationSupabaseFilters } from "@/lib/supabase/organizations";
import { getContactsFromSupabase } from "@/lib/supabase/contacts";
import { ClickableRow } from "@/app/components/clickable-row";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { FitBadge } from "@/app/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrgLogoSmall } from "@/app/components/org-logo";
import { NewOrgDialog } from "@/app/components/new-org-dialog";
import { TableSkeleton } from "@/app/components/skeletons";
import type { Organization } from "@/lib/notion/types";

const BLOATED_COPY_THRESHOLD = 450;

function GapBadges({ org, warmOrgIds }: { org: Organization; warmOrgIds: Set<string> }) {
  const needsEmail = !org.email;
  const needsWeb = !org.website && !org.linkedinUrl;
  const needsCopy = !org.bespokeEmailCopy || org.bespokeEmailCopy.length > BLOATED_COPY_THRESHOLD;
  const isWarm = warmOrgIds.has(org.id);
  const allGood = !needsEmail && !needsWeb && !needsCopy;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {allGood && <span className="text-green-600 text-xs font-medium" title="outreach-ready">✓</span>}
      {needsEmail && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-red-50 text-red-600 border-red-200" title="no email contact on file">email</Badge>
      )}
      {needsWeb && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200" title="no website or LinkedIn URL">web</Badge>
      )}
      {needsCopy && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200" title={!org.bespokeEmailCopy ? "no bespoke copy" : "copy too long"}>copy</Badge>
      )}
      {isWarm && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-teal-50 text-teal-600 border-teal-200" title="has a warm contact">warm</Badge>
      )}
    </div>
  );
}

const FIT_OPTIONS = ["🔥 Perfect fit", "✅ Strong fit", "🟡 Moderate fit"] as const;
const RELATIONSHIP_OPTIONS = ["stranger", "aware", "contacted", "in conversation", "collaborating", "active partner", "champion"] as const;
const SOURCE_OPTIONS = ["cold research", "conference", "direct network", "partner referral", "rfp platform", "internal"] as const;
const SEGMENT_OPTIONS = [
  "Higher Education / Business Schools", "Corporate L&D / Social Impact",
  "Foundations Running Grantee Programmes", "International Development / NGOs",
  "EdTech Product Companies", "Government Education Innovation",
  "UN Agencies & Multilaterals",
] as const;

interface OrgsTableProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function OrgsTable({ searchParams }: OrgsTableProps) {
  const params = await searchParams;
  const filters: OrganizationSupabaseFilters = {};
  if (params.fitRating)     filters.fitRating = params.fitRating;
  if (params.relationship)  filters.relationship = params.relationship;
  if (params.source)        filters.source = params.source;
  if (params.marketSegment) filters.marketSegment = params.marketSegment;
  if (params.search)        filters.search = params.search;

  const [{ data: organizations }, { data: allContacts }] = await Promise.all([
    getOrganizationsFromSupabase(filters, { pageSize: 500 }),
    getContactsFromSupabase({}, { pageSize: 500 }),
  ]);

  const warmOrgIds = new Set<string>();
  for (const contact of allContacts) {
    if (contact.relationshipStage && contact.relationshipStage !== "stranger") {
      for (const orgId of contact.organizationIds) {
        warmOrgIds.add(orgId);
      }
    }
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no organisations found. try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">organization</TableHead>
            <TableHead>relationship</TableHead>
            <TableHead>fit</TableHead>
            <TableHead>priority</TableHead>
            <TableHead>type</TableHead>
            <TableHead>segment</TableHead>
            <TableHead className="w-28">gaps</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <ClickableRow key={org.id} href={`/organizations/${org.id}`}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {org.logo && <OrgLogoSmall src={org.logo} name={org.organization} />}
                  {org.organization}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">{org.relationship}</Badge>
              </TableCell>
              <TableCell><FitBadge value={org.fitRating} /></TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{org.derivedPriority}</Badge>
              </TableCell>
              <TableCell>
                {org.type && <Badge variant="outline" className="text-xs">{org.type}</Badge>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                {org.marketSegment}
              </TableCell>
              <TableCell>
                <GapBadges org={org} warmOrgIds={warmOrgIds} />
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OrgsTabFilters() {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <Suspense>
        <SearchInput placeholder="search organisations..." />
        <FilterSelect paramKey="fitRating" placeholder="fit" options={FIT_OPTIONS} />
        <FilterSelect paramKey="relationship" placeholder="relationship" options={RELATIONSHIP_OPTIONS} />
        <FilterSelect paramKey="source" placeholder="source" options={SOURCE_OPTIONS} />
        <FilterSelect paramKey="marketSegment" placeholder="segment" options={SEGMENT_OPTIONS} />
      </Suspense>
    </div>
  );
}

export function OrgsTabActions() {
  return <NewOrgDialog />;
}

export function OrgsTabContent({ searchParams }: OrgsTableProps) {
  return (
    <Suspense fallback={<TableSkeleton columnCount={7} />}>
      <OrgsTable searchParams={searchParams} />
    </Suspense>
  );
}
