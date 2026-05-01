import { Suspense } from "react";
import { queryBdAssets } from "@/lib/notion/bd-assets";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink } from "lucide-react";
import type { BdAsset } from "@/lib/notion/types";
import { CardGridSkeleton } from "@/app/components/skeletons";
import { EmptyState } from "@/app/components/empty-state";
import { FolderOpen } from "lucide-react";

export const revalidate = 300;

const ASSET_TYPE_OPTIONS = [
  "case study", "deck", "tool", "template", "report",
  "one-pager", "video", "interactive", "workshop",
] as const;

const READINESS_COLORS: Record<string, string> = {
  ready: "bg-green-50 text-green-700 border-green-200",
  "in production": "bg-blue-50 text-blue-700 border-blue-200",
  draft: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "seeking feedback": "bg-orange-50 text-orange-700 border-orange-200",
  "needs prep": "bg-gray-100 text-gray-600 border-gray-200",
  "needs refresh": "bg-red-50 text-red-600 border-red-200",
  idea: "bg-purple-50 text-purple-700 border-purple-200",
};

function AssetCard({ asset }: { asset: BdAsset }) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${asset.featured ? "border-accent" : ""}`}>
      {asset.thumbnailUrl && (
        <div className="h-32 bg-muted rounded-t-lg overflow-hidden">
          <img
            src={asset.thumbnailUrl}
            alt={asset.asset}
            className="w-full h-full object-cover"
          />
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

function filterByReadiness(assets: BdAsset[], tab: string): BdAsset[] {
  switch (tab) {
    case "ready":
      return assets.filter((a) => a.readiness === "ready");
    case "in-progress":
      return assets.filter((a) =>
        ["draft", "in production", "seeking feedback"].includes(a.readiness)
      );
    case "needs-work":
      return assets.filter((a) =>
        ["needs prep", "needs refresh", "needs trace support", "needs final assets attached"].includes(a.readiness)
      );
    default:
      return assets;
  }
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function AssetGrid({ searchParams }: Props) {
  const params = await searchParams;
  const { data: allAssets } = await queryBdAssets(
    params.search ? { search: params.search } : undefined,
    { pageSize: 100 },
  );

  // Filter by asset type if specified
  const assets = params.assetType
    ? allAssets.filter((a) => a.assetType === params.assetType)
    : allAssets;

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="no assets found"
        description="try adjusting your filters or create a new asset to get started."
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

export default async function AssetsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="BD assets"
        description="case studies, decks, tools, and templates for business development"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search assets..." />
          <FilterSelect paramKey="assetType" placeholder="type" options={ASSET_TYPE_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<CardGridSkeleton />}>
        <AssetGrid searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
