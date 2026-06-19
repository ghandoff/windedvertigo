/**
 * timeline-tab.tsx — wraps the gantt with header + context.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineGantt } from "./timeline-gantt";
import { TIMELINE_RANGE, type CampaignTimeline } from "@/lib/strategy-data";

export interface TimelineTabProps {
  /** Campaign timelines fetched from Supabase by strategy/page.tsx. */
  timelines: CampaignTimeline[];
}

export function TimelineTab({ timelines }: TimelineTabProps) {
  return (
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
  );
}
