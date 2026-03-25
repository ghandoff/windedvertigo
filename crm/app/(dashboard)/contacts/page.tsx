import { Suspense } from "react";
import Link from "next/link";
import { queryContacts } from "@/lib/notion/contacts";
import { PageHeader } from "@/app/components/page-header";
import { ContactPipeline } from "@/app/components/contact-pipeline";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const STAGE_OPTIONS = [
  "stranger", "introduced", "in conversation", "warm connection",
  "active collaborator", "inner circle",
] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function ContactsTable({ searchParams }: Props) {
  const params = await searchParams;
  const filters: ContactFilters = {};
  if (params.contactType) filters.contactType = params.contactType as ContactFilters["contactType"];
  if (params.contactWarmth) filters.contactWarmth = params.contactWarmth as ContactFilters["contactWarmth"];
  if (params.relationshipStage) filters.relationshipStage = params.relationshipStage as ContactFilters["relationshipStage"];
  if (params.search) filters.search = params.search;

  const { data: contacts } = await queryContacts(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 100 },
  );

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no contacts found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">name</TableHead>
            <TableHead>role</TableHead>
            <TableHead>type</TableHead>
            <TableHead>warmth</TableHead>
            <TableHead>stage</TableHead>
            <TableHead>referral</TableHead>
            <TableHead>email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
              </TableCell>
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
              <TableCell>
                {c.relationshipStage && (
                  <Badge variant="secondary" className="text-xs">{c.relationshipStage}</Badge>
                )}
              </TableCell>
              <TableCell>
                {c.referralPotential && (
                  <Badge variant="secondary" className="text-xs">referral</Badge>
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

async function PipelineView() {
  const { data: contacts } = await queryContacts(undefined, { pageSize: 200 });
  return <ContactPipeline contacts={contacts} />;
}

export default async function ContactsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="contacts"
        description="people linked to organizations in the pipeline"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search contacts..." />
          <FilterSelect paramKey="contactType" placeholder="type" options={TYPE_OPTIONS} />
          <FilterSelect paramKey="contactWarmth" placeholder="warmth" options={WARMTH_OPTIONS} />
          <FilterSelect paramKey="relationshipStage" placeholder="stage" options={STAGE_OPTIONS} />
        </Suspense>
      </div>
      <Tabs defaultValue="pipeline">
        <TabsList className="mb-4">
          <TabsTrigger value="pipeline">pipeline</TabsTrigger>
          <TabsTrigger value="all">all contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading pipeline...</div>}>
            <PipelineView />
          </Suspense>
        </TabsContent>
        <TabsContent value="all">
          <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
            <ContactsTable searchParams={props.searchParams} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </>
  );
}
