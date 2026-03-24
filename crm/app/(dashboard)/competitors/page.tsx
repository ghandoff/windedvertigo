import { Suspense } from "react";
import { queryCompetitors } from "@/lib/notion/competitive";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";
import type { Competitor } from "@/lib/notion/types";

export const revalidate = 300;

const TYPE_OPTIONS = [
  "Direct Competitor", "Adjacent Player", "Conference / Event",
  "Network / Association", "Certification Body",
] as const;

const THREAT_CONFIG = {
  "🔴 High": { label: "high threat", color: "text-red-600", border: "border-red-200 bg-red-50/50" },
  "🟡 Medium": { label: "medium threat", color: "text-yellow-600", border: "border-yellow-200 bg-yellow-50/50" },
  "🟢 Low": { label: "low threat", color: "text-green-600", border: "border-green-200 bg-green-50/50" },
} as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

function CompetitorCard({ comp }: { comp: Competitor }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{comp.organisation}</CardTitle>
          {comp.type && (
            <Badge variant="outline" className="text-xs shrink-0">{comp.type}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {comp.geography.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {comp.geography.map((g) => (
              <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>
            ))}
          </div>
        )}

        {comp.quadrantOverlap.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {comp.quadrantOverlap.map((q) => (
              <Badge key={q} variant="outline" className="text-[10px]">{q}</Badge>
            ))}
          </div>
        )}

        {comp.whatTheyOffer && (
          <div>
            <span className="text-muted-foreground text-xs">what they offer</span>
            <p className="text-xs line-clamp-2">{comp.whatTheyOffer}</p>
          </div>
        )}

        {comp.whereWvWins && (
          <div className="bg-green-50 border border-green-200 rounded-md p-2">
            <span className="text-green-700 text-xs font-medium">where w.v wins</span>
            <p className="text-xs text-green-800 line-clamp-2">{comp.whereWvWins}</p>
          </div>
        )}

        {comp.url && (
          <a
            href={comp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Website
          </a>
        )}
      </CardContent>
    </Card>
  );
}

async function CompetitorsList({ searchParams }: Props) {
  const params = await searchParams;
  const filters: { type?: string; search?: string } = {};
  if (params.type) filters.type = params.type;
  if (params.search) filters.search = params.search;

  const { data: competitors } = await queryCompetitors(
    Object.keys(filters).length > 0 ? filters as Parameters<typeof queryCompetitors>[0] : undefined,
    { pageSize: 100 },
  );

  if (competitors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no competitors found.
      </div>
    );
  }

  // Group by threat level
  const groups = Object.entries(THREAT_CONFIG).map(([key, config]) => ({
    level: key,
    ...config,
    items: competitors.filter((c) => c.threatLevel === key),
  }));

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        group.items.length > 0 && (
          <div key={group.level}>
            <div className="flex items-center gap-2 mb-4">
              <h2 className={`text-lg font-semibold ${group.color}`}>
                {group.level.slice(0, 2)} {group.label}
              </h2>
              <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.items.map((comp) => (
                <CompetitorCard key={comp.id} comp={comp} />
              ))}
            </div>
            <Separator className="mt-8" />
          </div>
        )
      ))}
    </div>
  );
}

export default async function CompetitorsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="competitive landscape"
        description="competitors, adjacent players, and networks grouped by threat level"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search competitors..." />
          <FilterSelect paramKey="type" placeholder="type" options={TYPE_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
        <CompetitorsList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
