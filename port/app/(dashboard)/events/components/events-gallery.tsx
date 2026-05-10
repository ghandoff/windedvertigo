/**
 * events-gallery.tsx — card-grid view for the /events page.
 *
 * Migrated from campaigns/page.tsx EventCards component (Phase 10).
 * Receives pre-resolved searchParams from the parent Server Component.
 */

import Link from "next/link";
import { getEventsFromSupabase } from "@/lib/supabase/events";
import { EventTriageBar } from "../../campaigns/components/event-triage-bar";
import {
  EventStatusBadge,
  EventLifecycleBanner,
  EventProvenance,
} from "../../campaigns/components/event-status-badge";
import { EventContactsPanel } from "@/app/components/event-contacts-panel";
import { EventRetroModal } from "@/app/components/event-retro-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Users, Clock, Pencil } from "lucide-react";
import type { ConferenceStatus } from "@/lib/notion/types";

// ── helpers ────────────────────────────────────────────────────

/** Deterministic placeholder gradient for events without a cover image. */
const PLACEHOLDER_GRADIENTS = [
  "from-slate-200 to-slate-300",
  "from-blue-100 to-blue-200",
  "from-teal-100 to-teal-200",
  "from-amber-100 to-amber-200",
  "from-rose-100 to-rose-200",
  "from-violet-100 to-violet-200",
  "from-emerald-100 to-emerald-200",
  "from-orange-100 to-orange-200",
];

function placeholderGradient(seed: string): string {
  const code = seed ? seed.charCodeAt(0) : 0;
  return PLACEHOLDER_GRADIENTS[code % PLACEHOLDER_GRADIENTS.length];
}

function eventInitials(type: string | null | undefined, name: string): string {
  const source = type ?? name;
  return source
    .split(/[\s/\-_()]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

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

// ── component ──────────────────────────────────────────────────

interface Props {
  searchParams: Record<string, string | undefined>;
}

export async function EventsGallery({ searchParams }: Props) {
  const explicitStatus = searchParams.status as ConferenceStatus | undefined;

  const { data: events } = await getEventsFromSupabase(
    {
      upcoming: true,
      ...(searchParams.eventType       && { type: searchParams.eventType }),
      ...(searchParams.whoShouldAttend && { whoShouldAttend: searchParams.whoShouldAttend }),
      ...(searchParams.search          && { search: searchParams.search }),
      ...(explicitStatus               && { status: explicitStatus }),
    },
    { pageSize: 50 },
  );

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no events match these filters.
      </div>
    );
  }

  const formatCost = (n: number | null) =>
    n === null
      ? null
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {events.map((evt) => {
        const deadlineDays   = daysUntil(evt.proposalDeadline?.start);
        const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14;
        const estCost        = evt.estTravelCost ?? 0;
        const sponsCost      = evt.sponsorshipFee ?? 0;
        const totalEst       = estCost + sponsCost;
        const actCost        = evt.actualCostTotal;
        const showCostLine   = totalEst > 0 || actCost !== null;

        return (
          <Card key={evt.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {/* Cover image — og:image fetched by POST /api/events/{id}/cover;
                falls back to a deterministic gradient + initials placeholder. */}
            {evt.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={evt.coverImageUrl}
                alt=""
                className="w-full h-28 object-cover"
              />
            ) : (
              <div
                className={`w-full h-16 bg-gradient-to-br ${placeholderGradient(evt.type ?? evt.event)} flex items-center justify-center`}
              >
                <span className="text-xl font-semibold text-white/70 select-none tracking-widest">
                  {eventInitials(evt.type, evt.event)}
                </span>
              </div>
            )}
            <CardHeader className="pb-2">
              {/* Lifecycle banner — only renders for cancelled/postponed */}
              <EventLifecycleBanner lifecycle={evt.lifecycleState} />

              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-base leading-tight">{evt.event}</CardTitle>
                  <EventProvenance
                    discoveredVia={evt.discoveredVia}
                    triagedBy={evt.triagedBy}
                    triagedAt={evt.triagedAt}
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <EventStatusBadge status={evt.status} />
                  {evt.type && (
                    <Badge variant="outline" className="text-xs">{evt.type}</Badge>
                  )}
                  <Link
                    href={`/events/${evt.id}/edit`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit event"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              {evt.eventDates?.start && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(evt.eventDates.start)}
                    {evt.eventDates.end && ` – ${formatDate(evt.eventDates.end)}`}
                  </span>
                </div>
              )}
              {evt.proposalDeadline?.start && (
                <div
                  className={`flex items-center gap-2 ${
                    deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    deadline: {formatDate(evt.proposalDeadline.start)}
                    {deadlineDays !== null && deadlineDays >= 0 && (
                      <span className="ml-1">({deadlineDays}d)</span>
                    )}
                  </span>
                </div>
              )}
              {evt.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{evt.location}</span>
                </div>
              )}
              {evt.whoShouldAttend.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {evt.whoShouldAttend.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {evt.quadrantRelevance.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {evt.quadrantRelevance.map((q) => (
                    <Badge key={q} variant="outline" className="text-[10px]">{q}</Badge>
                  ))}
                </div>
              )}
              {evt.whyItMatters && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {evt.whyItMatters}
                </p>
              )}
              {showCostLine && (
                <p className="text-[10px] text-muted-foreground">
                  {totalEst > 0 && <span>{formatCost(totalEst)} est</span>}
                  {totalEst > 0 && actCost !== null && <span> · </span>}
                  {actCost !== null && <span>{formatCost(actCost)} actual</span>}
                </p>
              )}
              {evt.url && (
                <a
                  href={evt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-accent hover:underline inline-block"
                >
                  event website ↗
                </a>
              )}

              {/* Contacts panel (Phase 7) */}
              <EventContactsPanel
                eventId={evt.id}
                eventName={evt.event}
                eventEndDate={evt.eventDates?.end ?? evt.eventDates?.start ?? null}
              />

              {/* 4-button triage row: watch / attend / pursue / not relevant */}
              <EventTriageBar
                eventId={evt.id}
                eventName={evt.event}
                currentStatus={evt.status}
              />

              {/* Phase 15 retro modal — passive invite for past events */}
              {evt.lifecycleState === "past" && (
                <EventRetroModal
                  eventId={evt.id}
                  eventName={evt.event}
                  existingOutcomeNotes={evt.outcomeNotes || null}
                  existingContactsMetCount={evt.contactsMetCount ?? null}
                  existingFollowupDueBy={evt.followupDueBy ?? null}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
