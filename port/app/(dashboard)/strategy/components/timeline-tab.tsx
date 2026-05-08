/**
 * timeline-tab.tsx — wraps the gantt with header + context.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineGantt } from "./timeline-gantt";
import { TIMELINE_RANGE } from "@/lib/strategy-data";

export function TimelineTab() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#273248]">
          campaign roadmap · may → september 2026
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          all 6 campaigns plotted across the {TIMELINE_RANGE.totalDays}-day
          window. milestones marked with diamonds. today's position shown in
          redwood.
        </p>
      </CardHeader>
      <CardContent>
        <TimelineGantt />
      </CardContent>
    </Card>
  );
}
