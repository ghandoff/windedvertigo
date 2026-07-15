/**
 * timeline-tab.tsx — wraps the gantt(s) with header + context.
 *
 * Two sections:
 *   1. campaign roadmap — the original single-lane marketing-campaign Gantt
 *      (unchanged, still backed by strategy_campaign_timelines).
 *   2. workstream timeline — the multi-view Gantt upgrade (cmo_timeline_items):
 *      four toggle-able groupings + per-lane show/hide, one item set. See
 *      docs/prompts/strategy-brief-tab-port-build.md, "timeline tab —
 *      multiple toggle-able Gantt views".
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineGantt } from "./timeline-gantt";
import { TimelineMultiviewGantt } from "./timeline-multiview-gantt";
import { TIMELINE_RANGE, type CampaignTimeline } from "@/lib/strategy-data";
import type { TimelineItem } from "@/lib/supabase/cmo-timeline-items";

export interface TimelineTabProps {
  /** Campaign timelines fetched from Supabase by strategy/page.tsx. */
  timelines: CampaignTimeline[];
  /** Workstream/owner/horizon/track timeline items backing the multi-view Gantt. */
  items: TimelineItem[];
}

export function TimelineTab({ timelines, items }: TimelineTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            workstream timeline · by workstream / owner / horizon / mission vs survival
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} item{items.length === 1 ? "" : "s"} — switch views to regroup the
            same items; click a chip to hide/show a lane. view + lane choices persist
            across reloads.
          </p>
        </CardHeader>
        <CardContent>
          <TimelineMultiviewGantt items={items} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            campaign roadmap · may → september 2026
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {timelines.length} campaigns plotted across the {TIMELINE_RANGE.totalDays}-day
            window. milestones marked with diamonds. today&apos;s position shown in
            redwood.
          </p>
        </CardHeader>
        <CardContent>
          <TimelineGantt timelines={timelines} />
        </CardContent>
      </Card>
    </div>
  );
}
