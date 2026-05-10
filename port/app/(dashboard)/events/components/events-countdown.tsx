/**
 * events-countdown.tsx — deadline-sorted grid for the /events countdown view.
 *
 * Shows only events with a proposal_deadline, sorted soonest-first.
 * Each row displays a days-remaining badge with urgency color banding:
 *   ≤ 7 days  → red
 *   8–30 days → amber
 *   > 30 days → neutral
 *   past      → muted + strikethrough
 *
 * Phase 12 of the conference intelligence pipeline.
 */

import { getEventsFromSupabase } from "@/lib/supabase/events";
import { EventStatusBadge } from "../../campaigns/components/event-status-badge";
import { EventTriageBar } from "../../campaigns/components/event-triage-bar";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ConferenceStatus } from "@/lib/notion/types";

// ── helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Tailwind class sets — must be spelled out in full so purge doesn't drop them.
const BADGE_CLASSES = {
  urgent:  "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400",
  warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
  normal:  "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400",
  past:    "bg-muted text-muted-foreground border-border line-through",
} as const;

function urgencyClasses(days: number | null): string {
  if (days === null) return BADGE_CLASSES.normal;
  if (days < 0)     return BADGE_CLASSES.past;
  if (days <= 7)    return BADGE_CLASSES.urgent;
  if (days <= 30)   return BADGE_CLASSES.warning;
  return BADGE_CLASSES.normal;
}

// ── component ──────────────────────────────────────────────────────

interface Props {
  searchParams: Record<string, string | undefined>;
}

export async function EventsCountdown({ searchParams }: Props) {
  const explicitStatus = searchParams.status as ConferenceStatus | undefined;

  const { data: events } = await getEventsFromSupabase(
    {
      hasDeadline: true,
      ...(searchParams.eventType       && { type: searchParams.eventType }),
      ...(searchParams.whoShouldAttend && { whoShouldAttend: searchParams.whoShouldAttend }),
      ...(searchParams.search          && { search: searchParams.search }),
      ...(explicitStatus               && { status: explicitStatus }),
    },
    { pageSize: 100, sortBy: "proposal_deadline", sortDir: "asc" },
  );

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no upcoming deadlines match these filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((evt) => {
        const days    = daysUntil(evt.proposalDeadline?.start);
        const isPast  = days !== null && days < 0;
        const classes = urgencyClasses(days);

        const daysLabel =
          days === null    ? null
          : days < 0      ? "deadline passed"
          : days === 0    ? "today"
          : days === 1    ? "1 day"
          : `${days} days`;

        return (
          <div
            key={evt.id}
            className="flex items-start gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:shadow-sm transition-shadow"
          >
            {/* Days badge */}
            <div className="shrink-0 pt-0.5">
              <span
                className={`inline-flex flex-col items-center justify-center rounded-md border px-2.5 py-1 min-w-[3.5rem] text-center text-xs font-semibold tabular-nums ${classes}`}
              >
                {days !== null && !isPast && (
                  <span className="text-[15px] font-bold leading-tight">{Math.abs(days)}</span>
                )}
                <span className={days !== null && !isPast ? "text-[10px] leading-tight" : "text-xs"}>
                  {daysLabel ?? "—"}
                </span>
              </span>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{evt.event}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {evt.type}
                    {evt.location && ` · ${evt.location}`}
                    {evt.ownerUserId && ` · ${evt.ownerUserId}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <EventStatusBadge status={evt.status} />
                  <Link
                    href={`/events/${evt.id}/edit`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit event"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Deadline line with date */}
              <div className={`flex items-center gap-1.5 text-xs ${isPast ? "text-muted-foreground line-through" : days !== null && days <= 7 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                <Clock className="h-3 w-3 shrink-0" />
                <span>CFP closes: {formatDate(evt.proposalDeadline?.start)}</span>
              </div>

              {/* Attendees row (compact) */}
              {evt.whoShouldAttend.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {evt.whoShouldAttend.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Triage bar — condensed but still functional */}
              <div className="mt-2">
                <EventTriageBar
                  eventId={evt.id}
                  eventName={evt.event}
                  currentStatus={evt.status}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
