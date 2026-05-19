/**
 * CompetitorsTab — rendered as the "competitors" tab on the strategy page.
 * Async server component; fetches all competitors from Supabase and groups
 * by threat level. Same display logic as /competitors but without search/filter
 * controls (those live on the standalone page).
 */

import { getCompetitorsFromSupabase } from "@/lib/supabase/competitors";
import { CompetitorActions } from "@/app/components/competitor-actions";
import { CompetitorCardActions } from "@/app/components/competitor-card-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/app/components/empty-state";
import { ExternalLink, Shield } from "lucide-react";
import type { Competitor } from "@/lib/notion/types";

const THREAT_CONFIG = {
  "🔴 High": { label: "high threat", color: "text-red-600" },
  "🟡 Medium": { label: "medium threat", color: "text-yellow-600" },
  "🟢 Low": { label: "low threat", color: "text-green-600" },
} as const;

function CompetitorCard({ comp }: { comp: Competitor }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight flex-1">{comp.organisation}</CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {comp.type && (
              <Badge variant="outline" className="text-xs">{comp.type}</Badge>
            )}
            <CompetitorCardActions competitor={comp} />
          </div>
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
        {comp.url?.startsWith("http") && (
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

export async function CompetitorsTab() {
  const { data: competitors } = await getCompetitorsFromSupabase({}, { pageSize: 500 });

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="no competitors found"
        description="add competitors in notion to start tracking the landscape."
      />
    );
  }

  const groups = Object.entries(THREAT_CONFIG).map(([key, config]) => ({
    level: key,
    ...config,
    items: competitors.filter((c) => c.threatLevel === key),
  }));
  const ungrouped = competitors.filter((c) => !c.threatLevel);

  return (
    <>
      <CompetitorActions competitors={competitors} />
      <div className="space-y-8 mt-6">
        {groups.map((group) =>
          group.items.length > 0 ? (
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
          ) : null
        )}
        {ungrouped.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-muted-foreground">unclassified</h2>
              <Badge variant="secondary" className="text-xs">{ungrouped.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ungrouped.map((comp) => (
                <CompetitorCard key={comp.id} comp={comp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
