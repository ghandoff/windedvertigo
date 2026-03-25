import { Suspense } from "react";
import { querySocialDrafts } from "@/lib/notion/social";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SocialDraftForm } from "@/app/components/social-draft-form";
import type { SocialDraft } from "@/lib/notion/types";

export const revalidate = 300;

const STATUS_COLUMNS = [
  { key: "draft", label: "draft" },
  { key: "scheduled", label: "scheduled" },
  { key: "posted", label: "posted" },
] as const;

const PLATFORM_OPTIONS = ["linkedin", "twitter", "bluesky"] as const;

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700 border-blue-200",
  twitter: "bg-gray-100 text-gray-700 border-gray-200",
  bluesky: "bg-sky-100 text-sky-700 border-sky-200",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function DraftCard({ draft }: { draft: SocialDraft }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <p className="text-sm leading-snug line-clamp-3">{draft.content}</p>
        <div className="flex items-center gap-1.5">
          {draft.platform && (
            <Badge
              variant="outline"
              className={`text-[10px] ${PLATFORM_COLORS[draft.platform] ?? ""}`}
            >
              {draft.platform}
            </Badge>
          )}
          {draft.scheduledFor?.start && (
            <span className="text-[10px] text-muted-foreground">
              {formatDate(draft.scheduledFor.start)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function SocialBoard({ searchParams }: Props) {
  const params = await searchParams;
  const { data: drafts } = await querySocialDrafts(undefined, { pageSize: 100 });

  // Client-compatible filtering by search and platform
  let filtered = drafts;
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((d) => d.content.toLowerCase().includes(q));
  }
  if (params.platform) {
    filtered = filtered.filter((d) => d.platform === params.platform);
  }

  const columns = STATUS_COLUMNS.map((col) => ({
    ...col,
    items: filtered.filter((d) => d.status === col.key),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map((col) => (
        <div key={col.key} className="flex-shrink-0 w-80 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <h3 className="text-sm font-medium">{col.label}</h3>
            <Badge variant="secondary" className="text-xs">{col.items.length}</Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="p-2 space-y-2">
              {col.items.map((draft) => (
                <DraftCard key={draft.id} draft={draft} />
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

export default async function SocialPage(props: Props) {
  return (
    <>
      <PageHeader
        title="social queue"
        description="draft, schedule, and track social media posts"
      >
        <SocialDraftForm />
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search posts..." />
          <FilterSelect paramKey="platform" placeholder="platform" options={PLATFORM_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
        <SocialBoard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
