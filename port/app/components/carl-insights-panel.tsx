/**
 * CarlInsightsPanel — "what cARL prepared for you".
 *
 * cARL's daily study delivers Mo/Pam-track findings into their memory under
 * keys prefixed `carl-insight-`. This panel surfaces them at the top of the
 * Mo (/strategy) and Pam (/pam) dashboards, distinct from their own working
 * memory. Use `splitCarlInsights` to keep these out of the raw memory tab.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { AgentMemoryEntry } from "./agent-memory-panel";

const PREFIX = "carl-insight-";

export function splitCarlInsights(entries: AgentMemoryEntry[]): {
  insights: AgentMemoryEntry[];
  working: AgentMemoryEntry[];
} {
  const insights = entries
    .filter((e) => e.key.startsWith(PREFIX))
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  const working = entries.filter((e) => !e.key.startsWith(PREFIX));
  return { insights, working };
}

export function CarlInsightsPanel({
  entries,
  max = 8,
}: {
  entries: AgentMemoryEntry[];
  max?: number;
}) {
  const { insights } = splitCarlInsights(entries);
  if (insights.length === 0) return null;
  const shown = insights.slice(0, max);

  return (
    <Card className="border-l-2 border-l-primary/40">
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-medium">what cARL prepared for you</h3>
          <span className="text-[10px] text-muted-foreground">{insights.length} insight{insights.length === 1 ? "" : "s"}</span>
        </div>
        <ul className="space-y-2">
          {shown.map((m) => (
            <li key={m.key} className="text-xs leading-relaxed border-l border-border/60 pl-2">
              <p className="text-foreground/90">{m.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.updated_at?.slice(0, 10)}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
