/**
 * events-calendar-page.tsx — server data-fetch wrapper for the calendar view.
 *
 * Separates the async data fetch (server) from the interactive CalendarView
 * component (client). The parent events/page.tsx renders this in a Suspense
 * boundary so the tab doesn't block on load.
 */

import { getEventsFromSupabase } from "@/lib/supabase/events";
import { CalendarView } from "./events-calendar";
import type { ConferenceStatus } from "@/lib/notion/types";

interface Props {
  searchParams: Record<string, string | undefined>;
}

export async function EventsCalendarPage({ searchParams }: Props) {
  const explicitStatus = searchParams.status as ConferenceStatus | undefined;

  const { data: events } = await getEventsFromSupabase(
    {
      ...(searchParams.eventType       && { type: searchParams.eventType }),
      ...(searchParams.whoShouldAttend && { whoShouldAttend: searchParams.whoShouldAttend }),
      ...(searchParams.search          && { search: searchParams.search }),
      ...(explicitStatus               && { status: explicitStatus }),
    },
    { pageSize: 200, sortBy: "event_start", sortDir: "asc" },
  );

  return <CalendarView events={events} />;
}
