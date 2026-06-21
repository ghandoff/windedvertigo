import { Suspense } from "react";
import { getContactsFromSupabase, type ContactSupabaseFilters } from "@/lib/supabase/contacts";
import { ClickableRow } from "@/app/components/clickable-row";
import { NewContactDialog } from "@/app/components/new-contact-dialog";
import { PageHeader } from "@/app/components/page-header";
import { ContactPipeline } from "@/app/components/contact-pipeline";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KanbanSkeleton, TableSkeleton } from "@/app/components/skeletons";
import { EmptyState } from "@/app/components/empty-state";
import { Users } from "lucide-react";
import { OrgsTabFilters, OrgsTabActions, OrgsTabContent } from "./orgs-tab";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "pipeline", label: "pipeline" },
  { key: "all", label: "all contacts" },
  { key: "orgs", label: "organisations" },
];

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
  const filters: ContactSupabaseFilters = {};
  if (params.contactType)       filters.contactType = params.contactType;
  if (params.contactWarmth)     filters.contactWarmth = params.contactWarmth;
  if (params.relationshipStage) filters.relationshipStage = params.relationshipStage;
  if (params.search)            filters.search = params.search;

  const { data: contacts } = await getContactsFromSupabase(filters, { pageSize: 500 });

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="no contacts found"
        description="try adjusting your filters or add a new contact to get started."
      />
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">name</TableHead>
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
            <ClickableRow key={c.id} href={`/contacts/${c.id}`}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                    {c.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.profilePhotoUrl} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {c.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
                      </span>
                    )}
                  </div>
                  {c.name}
                </div>
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
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

async function PipelineView() {
  const { data: contacts } = await getContactsFromSupabase({}, { pageSize: 500 });
  return <ContactPipeline contacts={contacts} />;
}

export default async function ContactsPage(props: Props) {
  const params = await props.searchParams;
  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "pipeline";

  return (
    <>
      <PageHeader
        title="contacts"
        description="people linked to organizations in the pipeline"
      >
        {activeTab === "orgs" ? <OrgsTabActions /> : <NewContactDialog />}
      </PageHeader>

      <Suspense>
        <UrlTabs tabs={TABS} activeTab={activeTab} />
      </Suspense>

      {/* ── pipeline tab ──────────────────────────────────────── */}
      {activeTab === "pipeline" && (
        <Suspense fallback={<KanbanSkeleton columnCount={6} />}>
          <PipelineView />
        </Suspense>
      )}

      {/* ── all contacts tab ──────────────────────────────────── */}
      {activeTab === "all" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Suspense>
              <SearchInput placeholder="search contacts..." />
              <FilterSelect paramKey="contactType" placeholder="type" options={TYPE_OPTIONS} />
              <FilterSelect paramKey="contactWarmth" placeholder="warmth" options={WARMTH_OPTIONS} />
              <FilterSelect paramKey="relationshipStage" placeholder="stage" options={STAGE_OPTIONS} />
            </Suspense>
          </div>
          <Suspense fallback={<TableSkeleton columnCount={7} />}>
            <ContactsTable searchParams={props.searchParams} />
          </Suspense>
        </>
      )}

      {/* ── orgs tab ──────────────────────────────────────────── */}
      {activeTab === "orgs" && (
        <>
          <OrgsTabFilters />
          <OrgsTabContent searchParams={props.searchParams} />
        </>
      )}
    </>
  );
}
