import { Suspense } from "react";
import Link from "next/link";
import { queryEmailTemplates } from "@/lib/notion/email-templates";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { CardGridSkeleton } from "@/app/components/skeletons";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Mail, Globe, Hash, Cloud, Plus, Bookmark } from "lucide-react";
import type { EmailTemplate, EmailTemplateFilters } from "@/lib/notion/types";

export const revalidate = 300;

const CATEGORY_OPTIONS = ["outreach", "follow-up", "event invite", "newsletter", "other"] as const;
const CHANNEL_OPTIONS = ["email", "linkedin", "twitter", "bluesky"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  outreach: "bg-blue-100 text-blue-700 border-blue-200",
  "follow-up": "bg-green-100 text-green-700 border-green-200",
  "event invite": "bg-purple-100 text-purple-700 border-purple-200",
  newsletter: "bg-orange-100 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  linkedin: Globe,
  twitter: Hash,
  bluesky: Cloud,
};

// Priority order: templates most likely to be used first
const CATEGORY_PRIORITY: Record<string, number> = {
  outreach: 0,
  "follow-up": 1,
  "event invite": 2,
  newsletter: 3,
  other: 4,
};

function sortByLikelyUse(templates: EmailTemplate[]): EmailTemplate[] {
  return [...templates].sort((a, b) => {
    // Sort by usage first (most used = first)
    if ((b.timesUsed ?? 0) !== (a.timesUsed ?? 0)) return (b.timesUsed ?? 0) - (a.timesUsed ?? 0);
    // Then by category priority
    const aPri = CATEGORY_PRIORITY[a.category] ?? 99;
    const bPri = CATEGORY_PRIORITY[b.category] ?? 99;
    if (aPri !== bPri) return aPri - bPri;
    return a.name.localeCompare(b.name);
  });
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function TemplateGrid({ searchParams }: Props) {
  const params = await searchParams;
  const filters: EmailTemplateFilters = {};
  if (params.category) filters.category = params.category as EmailTemplateFilters["category"];
  if (params.channel) filters.channel = params.channel as EmailTemplateFilters["channel"];
  if (params.search) filters.search = params.search;

  const { data: templates } = await queryEmailTemplates(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 50 },
  );

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no templates yet. create one to get started.
      </div>
    );
  }

  const sorted = sortByLikelyUse(templates);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {sorted.map((t) => {
        const ChannelIcon = CHANNEL_ICONS[t.channel] ?? Mail;
        return (
          <Link key={t.id} href={`/campaigns/new?template=${t.id}`}>
            <Card className="hover:shadow-md hover:border-accent/50 transition-all cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChannelIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <CardTitle className="text-sm leading-tight truncate">{t.name}</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {t.category && (
                    <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[t.category] ?? ""}`}>
                      {t.category}
                    </Badge>
                  )}
                  {t.channel && t.channel !== "email" && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t.channel}
                    </Badge>
                  )}
                  {(t.timesUsed ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                      used {t.timesUsed}x
                    </Badge>
                  )}
                </div>
                {t.subject && (
                  <div>
                    <span className="text-muted-foreground">subject:</span>{" "}
                    <span className="font-medium">{t.subject}</span>
                  </div>
                )}
                {t.body && (
                  <p className="text-muted-foreground line-clamp-3">{t.body}</p>
                )}
                {t.notes && (
                  <p className="text-[10px] text-muted-foreground/70 italic line-clamp-1">{t.notes}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default async function TemplatesPage(props: Props) {
  return (
    <>
      <PageHeader
        title="templates"
        description="click any template to start a new campaign with it"
      >
        <Link
          href="/campaigns/templates/new"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Bookmark className="h-4 w-4" />
          new template
        </Link>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          new campaign
        </Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search templates..." />
          <FilterSelect paramKey="category" placeholder="category" options={CATEGORY_OPTIONS} />
          <FilterSelect paramKey="channel" placeholder="channel" options={CHANNEL_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<CardGridSkeleton />}>
        <TemplateGrid searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
