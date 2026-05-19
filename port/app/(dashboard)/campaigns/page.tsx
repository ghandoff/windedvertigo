import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { getSocialDraftsFromSupabase } from "@/lib/supabase/social";
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
import { KanbanSkeleton } from "@/app/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "campaigns", label: "campaigns" },
  { key: "email", label: "email" },
  { key: "social", label: "social" },
  // events tab moved to /events (Phase 10 migration)
];

const CAMPAIGN_TYPE_OPTIONS = ["event-based", "recurring cadence", "one-off blast"] as const;

const PLATFORM_OPTIONS = [
  "linkedin", "twitter", "bluesky", "instagram", "facebook", "substack",
] as const;

const STATUS_COLUMNS = [
  { key: "draft", label: "draft" },
  { key: "scheduled", label: "scheduled" },
  { key: "posted", label: "posted" },
] as const;

// ── campaigns board ──────────────────────────────────────────

interface BoardProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function CampaignBoard({ searchParams }: BoardProps) {
  const params = await searchParams;
  const campaigns = await getCampaignsFromSupabase(
    undefined,
    params.campaignType,
    params.search,
  );
  return <CampaignKanban campaigns={campaigns} />;
}

// ── social board ─────────────────────────────────────────────

async function SocialBoard() {
  const drafts = await getSocialDraftsFromSupabase();

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

  // Legacy redirect: any link that still uses ?tab=events → standalone /events page (Phase 10)
  if (params.tab === "events") {
    const next = new URLSearchParams(
      Object.entries(params).filter(([k]) => k !== "tab") as [string, string][],
    );
    const qs = next.toString();
    redirect(`/events${qs ? `?${qs}` : ""}`);
  }

  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "campaigns";

  const descriptions: Record<string, string> = {
    campaigns: "plan, schedule, and execute multi-step outreach campaigns",
    email: "compose and send outreach emails with pre-written bespoke copy",
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
            <Link href="/content">
              <Button variant="outline" size="sm" className="gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                content drafts
              </Button>
            </Link>
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
