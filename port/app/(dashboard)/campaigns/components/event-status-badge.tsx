/**
 * Status + lifecycle badges for the event tile.
 *
 * Status (user intent) drives the primary badge color/emphasis:
 *   candidate    — amber, pulses subtly to signal "needs human review"
 *   watch        — neutral grey, calm
 *   attend       — w.v teal, solid
 *   pursue       — bright teal, slightly emphasized
 *   not_relevant — hatched grey, muted
 *
 * Lifecycle (event reality) shows as a secondary banner ONLY when the event
 * is `cancelled` or `postponed` — those are the cases where the user's
 * triage state could be misleading without context.
 */

import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { ConferenceStatus, ConferenceLifecycle } from "@/lib/notion/types";

const STATUS_STYLES: Record<ConferenceStatus, { label: string; className: string }> = {
  candidate: {
    label: "candidate",
    className: "bg-amber-100 text-amber-900 border-amber-300 animate-pulse",
  },
  watch: {
    label: "watch",
    className: "bg-muted text-foreground/70 border-transparent",
  },
  attend: {
    label: "attend",
    // w.v teal #43b187 — using inline style to match palette without adding tailwind tokens
    className: "border-transparent text-white",
  },
  pursue: {
    label: "pursue",
    className: "border-transparent text-white",
  },
  not_relevant: {
    label: "not relevant",
    className: "bg-muted text-muted-foreground border-transparent line-through",
  },
};

export function EventStatusBadge({ status }: { status: ConferenceStatus }) {
  const cfg = STATUS_STYLES[status];
  // Inline color for attend/pursue — keeps the wv-teal palette consistent
  // without expanding tailwind theme tokens for one-off UI.
  const inline =
    status === "attend"
      ? { backgroundColor: "rgba(67, 177, 135, 0.85)" }
      : status === "pursue"
      ? { backgroundColor: "rgba(67, 177, 135, 1)" }
      : undefined;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium px-1.5 py-0 ${cfg.className}`}
      style={inline}
    >
      {cfg.label}
    </Badge>
  );
}

export function EventLifecycleBanner({ lifecycle }: { lifecycle: ConferenceLifecycle }) {
  if (lifecycle !== "cancelled" && lifecycle !== "postponed") return null;
  const isCancelled = lifecycle === "cancelled";
  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md mb-2 ${
        isCancelled
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-50 text-amber-900"
      }`}
    >
      <AlertTriangle className="h-3 w-3" />
      <span>{isCancelled ? "event cancelled" : "event postponed"}</span>
    </div>
  );
}

const DISCOVERY_LABELS: Record<string, string> = {
  manual: "manual entry",
  "org-affiliated": "via org affiliation",
  newsletter: "via newsletter scan",
  "slack-paste": "via slack paste",
  "broad-scout": "via topic scout",
};

export function EventProvenance({
  discoveredVia,
  triagedBy,
  triagedAt,
}: {
  discoveredVia: string;
  triagedBy: string | null;
  triagedAt: string | null;
}) {
  const provenance = DISCOVERY_LABELS[discoveredVia] ?? discoveredVia;
  const triagedLine = triagedBy
    ? `· last triaged by ${triagedBy.split("@")[0]}${
        triagedAt ? ` on ${new Date(triagedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""
      }`
    : "";
  return (
    <p className="text-[10px] text-muted-foreground/70">
      {provenance} {triagedLine}
    </p>
  );
}
