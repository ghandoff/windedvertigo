import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { getBdAssetsFromSupabase } from "@/lib/supabase/bd-assets";
import {
  listComposeDrafts,
  CHANNEL_LABELS,
  CHANNEL_CHAR_LIMITS,
} from "@/lib/supabase/compose-drafts";
import type { BdAsset } from "@/lib/notion/types";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { CampaignKanban } from "@/app/components/campaign-kanban";
import { CampaignStatsStrip, CampaignStatsStripSkeleton } from "@/app/components/campaign-stats-strip";
import { CampaignWeeklySummary, CampaignWeeklySummarySkeleton } from "@/app/components/campaign-weekly-summary";
import { EmailComposer } from "@/app/components/email-composer";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { KanbanSkeleton, CardGridSkeleton } from "@/app/components/skeletons";
import { EmptyState } from "@/app/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, PenLine, ExternalLink, FolderOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewDraftForm } from "../compose/new-draft-form";

export const revalidate = 300;

const TABS: TabDef[] = [
  { key: "campaigns", label: "campaigns" },
  { key: "email", label: "email" },
  { key: "assets", label: "assets" },
  { key: "drafts", label: "drafts" },
  // events tab moved to /events (Phase 10 migration)
];

const CAMPAIGN_TYPE_OPTIONS = ["event-based", "recurring cadence", "one-off blast"] as const;

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
    // complete campaigns hidden by default — they clutter the board
  );
  return <CampaignKanban campaigns={campaigns} />;
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

// ── drafts content ───────────────────────────────────────────

const DRAFT_STATUS_CLASS: Record<string, string> = {
  draft:     "text-muted-foreground bg-muted/20",
  scheduled: "text-[#5872cb] bg-[#5872cb]/10",
  published: "text-[#43b187] bg-[#43b187]/10",
  failed:    "text-[#b15043] bg-[#b15043]/10",
};

function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function DraftsContent() {
  const drafts = await listComposeDrafts({ limit: 100 });

  return (
    <div className="space-y-6">
      <NewDraftForm />
      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            no drafts yet. pick a channel above to start your first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <Card key={d.id} className="hover:border-[#cb7858] transition-colors">
              <CardContent className="py-3">
                <Link href={`/compose/${d.id}`} className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Send className="h-4 w-4 text-[#5872cb]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${DRAFT_STATUS_CLASS[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {CHANNEL_LABELS[d.channel]} · updated {formatDraftDate(d.updatedAt)} · {d.authorEmail}
                      </span>
                    </div>
                    {d.title && (
                      <p className="text-sm text-[#273248] mt-1">{d.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {d.contentText.slice(0, 200) || <span className="italic opacity-60">(empty)</span>}
                    </p>
                    {CHANNEL_CHAR_LIMITS[d.channel] !== null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                        {d.contentText.length} / {CHANNEL_CHAR_LIMITS[d.channel]} chars
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
    assets: "case studies, decks, tools, and templates for business development",
    drafts: "draft posts across LinkedIn · Bluesky · Substack · Meta · email",
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

      {/* ── assets tab ─────────────────────────────────────── */}
      {activeTab === "assets" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <AssetsContent />
        </Suspense>
      )}

      {/* ── drafts tab ─────────────────────────────────────── */}
      {activeTab === "drafts" && (
        <Suspense fallback={
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        }>
          <DraftsContent />
        </Suspense>
      )}
    </>
  );
}
