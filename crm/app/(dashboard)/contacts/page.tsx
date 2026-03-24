import { Suspense } from "react";
import { queryContacts } from "@/lib/notion/contacts";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ContactFilters } from "@/lib/notion/types";

export const revalidate = 300;

const WARMTH_COLORS: Record<string, string> = {
  cold: "bg-blue-400",
  lukewarm: "bg-yellow-400",
  warm: "bg-orange-400",
  hot: "bg-red-500",
};

const TYPE_OPTIONS = [
  "decision maker", "program officer", "collaborator", "referral source",
  "team member", "manager", "ceo", "consultant",
] as const;

const WARMTH_OPTIONS = ["cold", "lukewarm", "warm", "hot"] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function ContactsTable({ searchParams }: Props) {
  const params = await searchParams;
  const filters: ContactFilters = {};
  if (params.contactType) filters.contactType = params.contactType as ContactFilters["contactType"];
  if (params.contactWarmth) filters.contactWarmth = params.contactWarmth as ContactFilters["contactWarmth"];
  if (params.search) filters.search = params.search;

  const { data: contacts } = await queryContacts(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 100 },
  );

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No contacts found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Warmth</TableHead>
            <TableHead>Responsiveness</TableHead>
            <TableHead>Referral</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.role}</TableCell>
              <TableCell>
                {c.contactType && (
                  <Badge variant="outline" className="text-xs">{c.contactType}</Badge>
                )}
              </TableCell>
              <TableCell>
                {c.contactWarmth && (
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${WARMTH_COLORS[c.contactWarmth] ?? "bg-gray-300"}`} />
                    <span className="text-xs">{c.contactWarmth}</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {c.responsiveness}
              </TableCell>
              <TableCell>
                {c.referralPotential && (
                  <Badge variant="secondary" className="text-xs">Referral</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="text-accent hover:underline">
                    {c.email}
                  </a>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function ContactsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="Contacts"
        description="People linked to organizations in the pipeline"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="Search contacts..." />
          <FilterSelect paramKey="contactType" placeholder="Type" options={TYPE_OPTIONS} />
          <FilterSelect paramKey="contactWarmth" placeholder="Warmth" options={WARMTH_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">Loading...</div>}>
        <ContactsTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
