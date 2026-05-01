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
  // Primary (4 promoted)
  fitRating: "fit",
  relationship: "relationship",
  source: "source",
  marketSegment: "segment",
  // Secondary (retained for display)
  quadrant: "quadrant",
  type: "type",
  category: "category",
  region: "region",
  // Legacy (still render if present in old campaign data)
  priority: "priority",
  friendship: "friendship",
  outreachStatus: "outreach",
  connection: "connection",
};

export function AudiencePanel({ filters, count, preview }: AudiencePanelProps) {
  const INTERNAL_KEYS = new Set(["addedOrgIds", "removedOrgIds", "addedContactIds", "removedContactIds"]);
  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => !INTERNAL_KEYS.has(k) && v !== undefined && v !== null && v !== "",
  );
  const manualCount = (filters.addedOrgIds?.length ?? 0) - (filters.removedOrgIds?.length ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">target audience</CardTitle>
          <Badge variant="secondary">{count} orgs</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(activeFilters.length > 0 || manualCount > 0) ? (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-[10px]">
                {FILTER_LABELS[key] ?? key}: {Array.isArray(value) ? value.join(", ") : String(value)}
              </Badge>
            ))}
            {manualCount > 0 && (
              <Badge variant="outline" className="text-[10px]">
                manually added: {manualCount}
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            no audience filters set — add filters or manually add organisations in the campaign wizard.
          </p>
        )}

        {preview.length > 0 && (
          <>
            <div className="space-y-2">
              {preview.map((org) => (
                <div key={org.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{org.organization}</span>
                  <Badge variant="outline" className="text-[9px] ml-2 shrink-0">
                    {org.derivedPriority}
                  </Badge>
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
              no organisations match these filters
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
