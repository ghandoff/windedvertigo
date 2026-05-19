import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { getSocialDraftsFromSupabase } from "@/lib/supabase/social";
import { getBdAssetsFromSupabase } from "@/lib/supabase/bd-assets";
import type { BdAsset } from "@/lib/notion/types";
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
import { EmptyState } from "@/app/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, PenLine, ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "campaigns", label: "campaigns" },
  { key: "email", label: "email" },
  { key: "social", label: "social" },
  { key: "assets", label: "assets" },
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

// ── assets board ─────────────────────────────────────────────

const READINESS_COLORS: Record<string, string> = {
  ready: "bg-green-50 text-green-700 border-green-200",
  "in production": "bg-blue-50 text-blue-700 border-blue-200",
  draft: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "seeking feedback": "bg-orange-50 text-orange-700 border-orange-200",
  "needs prep": "bg-gray-100 text-gray-600 border-gray-200",
  "needs refresh": "bg-red-50 text-red-600 border-red-200",
  idea: "bg-purple-50 text-purple-700 border-purple-200",
};

function filterByReadiness(assets: BdAsset[], tab: string): BdAsset[] {
  switch (tab) {
    case "ready":
      return assets.filter((a) => a.readiness === "ready");
    case "in-progress":
      return assets.filter((a) =>
        ["draft", "in production", "seeking feedback"].includes(a.readiness),
      );
    case "needs-work":
      return assets.filter((a) =>
        ["needs prep", "needs refresh", "needs trace support", "needs final assets attached"].includes(a.readiness),
      );
    default:
      return assets;
  }
}

function AssetCard({ asset }: { asset: BdAsset }) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${asset.featured ? "border-accent" : ""}`}>
      {asset.thumbnailUrl && (
        <div className="h-32 bg-muted rounded-t-lg overflow-hidden">
          <img src={asset.thumbnailUrl} alt={asset.asset} className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-tight">{asset.asset}</CardTitle>
          {asset.featured && (
            <Badge variant="outline" className="text-[10px] border-accent text-accent shrink-0">
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {asset.assetType && (
            <Badge variant="secondary" className="text-[10px]">{asset.assetType}</Badge>
          )}
          {asset.readiness && (
            <Badge
              variant="outline"
              className={`text-[10px] ${READINESS_COLORS[asset.readiness] ?? ""}`}
            >
              {asset.readiness}
            </Badge>
          )}
        </div>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((t) => (
              <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
        {asset.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
        )}
        {asset.url?.startsWith("http") && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            view asset
          </a>
        )}
      </CardContent>
    </Card>
  );
}

async function AssetsContent() {
  const { data: assets } = await getBdAssetsFromSupabase({}, { pageSize: 500 });

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="no assets found"
        description="add BD assets in notion to populate this library."
      />
    );
  }

  return (
    <Tabs defaultValue="all">
      <TabsList className="mb-4">
        <TabsTrigger value="all">all ({assets.length})</TabsTrigger>
        <TabsTrigger value="ready">ready ({filterByReadiness(assets, "ready").length})</TabsTrigger>
        <TabsTrigger value="in-progress">in progress ({filterByReadiness(assets, "in-progress").length})</TabsTrigger>
        <TabsTrigger value="needs-work">needs work ({filterByReadiness(assets, "needs-work").length})</TabsTrigger>
      </TabsList>
      {["all", "ready", "in-progress", "needs-work"].map((tab) => (
        <TabsContent key={tab} value={tab}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filterByReadiness(assets, tab).map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
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
    assets: "case studies, decks, tools, and templates for business development",
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

      {/* ── assets tab ─────────────────────────────────────── */}
      {activeTab === "assets" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <AssetsContent />
        </Suspense>
      )}
    </>
  );
}
