"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AudienceFilter, Organization } from "@/lib/notion/types";

interface AudiencePanelProps {
  campaignId: string;
  filters: AudienceFilter;
  count: number;
  preview: Organization[];
}

const FILTER_LABELS: Record<string, string> = {
  priority: "priority",
  fitRating: "fit",
  friendship: "friendship",
  outreachStatus: "outreach",
  connection: "connection",
  quadrant: "quadrant",
  marketSegment: "segment",
  type: "type",
  category: "category",
  region: "region",
  source: "source",
};

export function AudiencePanel({ filters, count, preview }: AudiencePanelProps) {
  const activeFilters = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">target audience</CardTitle>
          <Badge variant="secondary">{count} orgs</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-[10px]">
                {FILTER_LABELS[key] ?? key}: {Array.isArray(value) ? value.join(", ") : String(value)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            no audience filters set. edit the campaign&apos;s audience filters in Notion to target specific organizations.
          </p>
        )}

        {preview.length > 0 && (
          <>
            <div className="space-y-2">
              {preview.map((org) => (
                <div key={org.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{org.organization}</span>
                  {org.priority && (
                    <Badge variant="outline" className="text-[9px] ml-2 shrink-0">
                      {org.priority.replace(/ – .+/, "")}
                    </Badge>
                  )}
                </div>
              ))}
              {count > preview.length && (
                <p className="text-[10px] text-muted-foreground">
                  and {count - preview.length} more...
                </p>
              )}
            </div>
          </>
        )}

        {count === 0 && activeFilters.length > 0 && (
          <div className="text-center py-4">
            <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              no organizations match these filters
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
