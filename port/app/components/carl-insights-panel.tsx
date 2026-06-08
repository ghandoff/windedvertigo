/**
 * CarlInsightsPanel — "what cARL prepared for you".
 *
 * cARL's daily study delivers Mo/Pam-track findings into their memory under
 * keys prefixed `carl-insight-`. This panel surfaces them at the top of the
 * Mo (/strategy) and Pam (/pam) dashboards, distinct from their own working
 * memory. Use `splitCarlInsights` to keep these out of the raw memory tab.
 */

import type { AgentMemoryEntry } from "./agent-memory-panel";
import { CarlInsightsCollapsible } from "./carl-insights-collapsible";

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
  return <CarlInsightsCollapsible insights={insights.slice(0, max)} total={insights.length} />;
}
