import { Sparkles } from "lucide-react";
import type { Activity } from "@/lib/notion/types";

/**
 * Compute activity pattern insights from raw data — no AI API call needed.
 * This is a server component (no "use client") for zero-cost inline insights.
 */
export function AiActivityInsight({ activities }: { activities: Activity[] }) {
  if (activities.length < 2) return null;

  const now = new Date();
  const insights: string[] = [];

  // Days since last activity
  const lastDate = activities[0]?.date?.start;
  if (lastDate) {
    const daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 30) {
      insights.push(`no contact in ${daysSince} days — relationship may be cooling`);
    } else if (daysSince > 14) {
      insights.push(`last touchpoint ${daysSince} days ago — consider a follow-up`);
    }
  }

  // Outcome patterns
  const outcomes = activities.slice(0, 10).map((a) => a.outcome).filter(Boolean);
  const positiveRate = outcomes.filter((o) => o === "positive").length / (outcomes.length || 1);
  if (outcomes.length >= 3 && positiveRate >= 0.7) {
    insights.push(`${Math.round(positiveRate * 100)}% positive responses — strong engagement pattern`);
  }
  if (outcomes.length >= 3 && positiveRate < 0.3) {
    insights.push("mostly neutral/negative outcomes — consider changing approach");
  }

  // Response timing pattern
  const emailsSent = activities.filter((a) => a.type === "email sent");
  const emailsReceived = activities.filter((a) => a.type === "email received");
  if (emailsSent.length > 0 && emailsReceived.length > 0) {
    const sentDate = emailsSent[0]?.date?.start;
    const receivedDate = emailsReceived[0]?.date?.start;
    if (sentDate && receivedDate) {
      const gap = Math.abs(new Date(receivedDate).getTime() - new Date(sentDate).getTime());
      const gapDays = Math.round(gap / (1000 * 60 * 60 * 24));
      if (gapDays <= 3) {
        insights.push(`typically responds within ${gapDays} day${gapDays === 1 ? "" : "s"}`);
      }
    }
  }

  // Activity frequency
  if (activities.length >= 5) {
    const firstDate = activities[activities.length - 1]?.date?.start;
    if (firstDate && lastDate) {
      const span = (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24);
      if (span > 0) {
        const frequency = Math.round(span / activities.length);
        insights.push(`avg ${frequency} days between touchpoints`);
      }
    }
  }

  if (insights.length === 0) return null;

  return (
    <div className="mt-4 p-3 rounded-lg border border-dashed bg-muted/30">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">activity insights</span>
      </div>
      <ul className="space-y-1">
        {insights.map((insight, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}
