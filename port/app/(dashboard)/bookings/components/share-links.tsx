/**
 * Share-link directory shown above the upcoming-bookings list on /bookings.
 * Groups event-type URLs by mode + a prominent CTA into the internal
 * find-a-time panel.
 *
 * Server component — receives event_types pre-fetched from booking-supabase.
 */

import Link from "next/link";
import type { EventType } from "@/lib/booking/types";
import { CopyLinkButton } from "./copy-link-button";
import { CalendarClock, Users, UserCircle } from "lucide-react";

const SITE_ORIGIN = "https://windedvertigo.com";

interface Props {
  eventTypes: EventType[];
}

function durationLabel(ev: EventType): string {
  if (ev.duration_options && ev.duration_options.length > 0) {
    return ev.duration_options
      .slice()
      .sort((a, b) => a - b)
      .join("/") + " min";
  }
  return `${ev.duration_min} min`;
}

function ShareRow({ ev }: { ev: EventType }) {
  const url = `${SITE_ORIGIN}/book/${ev.slug}`;
  return (
    <li className="flex items-center justify-between gap-3 rounded border p-3 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {ev.title}
          </a>
          <span className="text-xs text-muted-foreground">
            {durationLabel(ev)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
          /book/{ev.slug}
        </div>
      </div>
      <CopyLinkButton url={url} />
    </li>
  );
}

export function ShareLinks({ eventTypes }: Props) {
  const collective = eventTypes.filter((e) => e.mode === "collective" && e.active);
  const roundRobin = eventTypes.filter((e) => e.mode === "round_robin" && e.active);
  const solo = eventTypes.filter((e) => e.mode === "solo" && e.active);

  // Order by slug for stable, predictable display
  const sorted = (xs: EventType[]) => xs.slice().sort((a, b) => a.slug.localeCompare(b.slug));

  return (
    <section className="rounded-md border p-5 mb-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium">share booking links</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            send these to clients, family, or anyone scheduling time with the collective.
          </p>
        </div>
        <Link
          href="/bookings/find-a-time"
          className="inline-flex items-center gap-1.5 rounded bg-foreground text-background text-xs px-3 py-1.5 hover:opacity-90"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          find a time across our calendars
        </Link>
      </div>

      {collective.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            collective (2+ members)
          </h3>
          <ul className="space-y-1.5">
            {sorted(collective).map((ev) => (
              <ShareRow key={ev.id} ev={ev} />
            ))}
          </ul>
        </div>
      )}

      {roundRobin.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            round-robin (whoever's most available)
          </h3>
          <ul className="space-y-1.5">
            {sorted(roundRobin).map((ev) => (
              <ShareRow key={ev.id} ev={ev} />
            ))}
          </ul>
        </div>
      )}

      {solo.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <UserCircle className="h-3.5 w-3.5" />
            individual (1:1)
          </h3>
          <ul className="space-y-1.5">
            {sorted(solo).map((ev) => (
              <ShareRow key={ev.id} ev={ev} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
