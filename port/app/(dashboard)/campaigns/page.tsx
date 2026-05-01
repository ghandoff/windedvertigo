import { Suspense } from "react";
import Link from "next/link";
import { queryCampaigns } from "@/lib/notion/campaigns";
import { queryEvents } from "@/lib/notion/events";
import { querySocialDrafts } from "@/lib/notion/social";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { CampaignKanban } from "@/app/components/campaign-kanban";
import { CampaignStatsStrip, CampaignStatsStripSkeleton } from "@/app/components/campaign-stats-strip";
import { CampaignWeeklySummary, CampaignWeeklySummarySkeleton } from "@/app/components/campaign-weekly-summary";
import { EmailComposer } from "@/app/components/email-composer";
import { SocialDraftForm } from "@/app/components/social-draft-form";
import { SocialDraftCard } from "@/app/components/social-draft-card";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { KanbanSkeleton, CardGridSkeleton } from "@/app/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, MapPin, Users, Clock, Pencil, Plus } from "lucide-react";
import type { CampaignFilters, EventFilters } from "@/lib/notion/types";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "campaigns", label: "campaigns" },
  { key: "email", label: "email" },
  { key: "events", label: "events" },
  { key: "social", label: "social" },
];

const CAMPAIGN_TYPE_OPTIONS = ["event-based", "recurring cadence", "one-off blast"] as const;

const EVENT_TYPE_OPTIONS = [
  "Conference", "Summit", "Trade Show", "Academic Conference",
  "Awards / Ceremony", "Network Event",
] as const;

const TEAM_OPTIONS = ["Garrett", "María", "Jamie", "Lamis", "Yigal"] as const;

const PLATFORM_OPTIONS = [
  "linkedin", "twitter", "bluesky", "instagram", "facebook", "substack",
] as const;

const STATUS_COLUMNS = [
  { key: "draft", label: "draft" },
  { key: "scheduled", label: "scheduled" },
  { key: "posted", label: "posted" },
] as const;

// ── helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── campaigns board ──────────────────────────────────────────

interface BoardProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function CampaignBoard({ searchParams }: BoardProps) {
  const params = await searchParams;
  const filters: CampaignFilters = {};
  if (params.campaignType) filters.type = params.campaignType as CampaignFilters["type"];
  if (params.search) filters.search = params.search;

  const { data: campaigns } = await queryCampaigns(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 100 },
  );

  return <CampaignKanban campaigns={campaigns} />;
}

// ── events board ─────────────────────────────────────────────

async function EventCards({ searchParams }: BoardProps) {
  const params = await searchParams;
  const filters: EventFilters = { upcoming: true };
  if (params.eventType) filters.type = params.eventType as EventFilters["type"];
  if (params.whoShouldAttend) filters.whoShouldAttend = params.whoShouldAttend as EventFilters["whoShouldAttend"];
  if (params.search) filters.search = params.search;

  const { data: events } = await queryEvents(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 50 },
  );

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no upcoming events found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {events.map((evt) => {
        const deadlineDays = daysUntil(evt.proposalDeadline?.start);
        const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14;

        return (
          <Card key={evt.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{evt.event}</CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  {evt.type && (
                    <Badge variant="outline" className="text-xs">{evt.type}</Badge>
                  )}
                  <Link
                    href={`/events/${evt.id}/edit`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit event"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {evt.eventDates?.start && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(evt.eventDates.start)}
                    {evt.eventDates.end && ` – ${formatDate(evt.eventDates.end)}`}
                  </span>
                </div>
              )}
              {evt.proposalDeadline?.start && (
                <div className={`flex items-center gap-2 ${deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    deadline: {formatDate(evt.proposalDeadline.start)}
                    {deadlineDays !== null && deadlineDays >= 0 && (
                      <span className="ml-1">({deadlineDays}d)</span>
                    )}
                  </span>
                </div>
              )}
              {evt.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{evt.location}</span>
                </div>
              )}
              {evt.whoShouldAttend.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {evt.whoShouldAttend.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {evt.quadrantRelevance.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {evt.quadrantRelevance.map((q) => (
                    <Badge key={q} variant="outline" className="text-[10px]">{q}</Badge>
                  ))}
                </div>
              )}
              {evt.whyItMatters && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {evt.whyItMatters}
                </p>
              )}
              <div className="flex items-center gap-3 pt-1 border-t">
                <Link
                  href={`/campaigns/new?event=${evt.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  start campaign
                </Link>
                {evt.url && (
                  <a
                    href={evt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-accent hover:underline"
                  >
                    event website
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── social board ─────────────────────────────────────────────

async function SocialBoard() {
  const { data: drafts } = await querySocialDrafts(undefined, { pageSize: 100 });

  const grouped = STATUS_COLUMNS.map((col) => ({
    ...col,
    items: drafts.filter((d) => d.status === col.key),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {grouped.map((col) => (
        <div key={col.key} className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <h3 className="text-sm font-medium">{col.label}</h3>
            <Badge variant="secondary" className="text-xs">{col.items.length}</Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-420px)]">
            <div className="p-2 space-y-2">
              {col.items.map((draft) => (
                <SocialDraftCard key={draft.id} draft={draft} />
              ))}
              {col.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  no {col.label} posts
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CampaignsPage(props: Props) {
  const params = await props.searchParams;
  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "campaigns";

  const descriptions: Record<string, string> = {
    campaigns: "plan, schedule, and execute multi-step outreach campaigns",
    email: "compose and send outreach emails with pre-written bespoke copy",
    events: "track upcoming events, proposal deadlines, and who should attend",
    social: "draft, schedule, and track social media posts",
  };

  return (
    <>
      <PageHeader
        title="campaigns"
        description={descriptions[activeTab] ?? descriptions.campaigns}
      >
        {activeTab === "campaigns" && (
          <>
            <Link
              href="/campaigns/calendar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              calendar
            </Link>
            <Link
              href="/campaigns/templates"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              templates
            </Link>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              new campaign
            </Link>
          </>
        )}
        {activeTab === "events" && (
          <Link
            href="/events/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            add event
          </Link>
        )}
        {activeTab === "social" && <SocialDraftForm />}
      </PageHeader>

      <Suspense>
        <UrlTabs tabs={TABS} activeTab={activeTab} />
      </Suspense>

      {/* ── campaigns tab ──────────────────────────────────── */}
      {activeTab === "campaigns" && (
        <>
          <Suspense fallback={<CampaignStatsStripSkeleton />}>
            <CampaignStatsStrip />
          </Suspense>
          <Suspense fallback={<CampaignWeeklySummarySkeleton />}>
            <CampaignWeeklySummary />
          </Suspense>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Suspense>
              <SearchInput placeholder="search campaigns..." />
              <FilterSelect paramKey="campaignType" placeholder="type" options={CAMPAIGN_TYPE_OPTIONS} />
            </Suspense>
          </div>
          <Suspense fallback={<KanbanSkeleton />}>
            <CampaignBoard searchParams={props.searchParams} />
          </Suspense>
        </>
      )}

      {/* ── email tab ──────────────────────────────────────── */}
      {activeTab === "email" && (
        <Suspense fallback={
          <div className="space-y-4 max-w-2xl">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        }>
          <EmailComposer preselectedOrgId={params.org} />
        </Suspense>
      )}

      {/* ── events tab ─────────────────────────────────────── */}
      {activeTab === "events" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Suspense>
              <SearchInput placeholder="search events..." />
              <FilterSelect paramKey="eventType" placeholder="type" options={EVENT_TYPE_OPTIONS} />
              <FilterSelect paramKey="whoShouldAttend" placeholder="attendee" options={TEAM_OPTIONS} />
            </Suspense>
          </div>
          <Suspense fallback={<CardGridSkeleton />}>
            <EventCards searchParams={props.searchParams} />
          </Suspense>
        </>
      )}

      {/* ── social tab ─────────────────────────────────────── */}
      {activeTab === "social" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Suspense>
              <SearchInput placeholder="search posts..." />
              <FilterSelect paramKey="platform" placeholder="platform" options={PLATFORM_OPTIONS} />
            </Suspense>
          </div>
          <Suspense fallback={<KanbanSkeleton columnCount={3} />}>
            <SocialBoard />
          </Suspense>
        </>
      )}
    </>
  );
}
