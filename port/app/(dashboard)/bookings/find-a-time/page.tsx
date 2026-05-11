/**
 * /bookings/find-a-time — internal team-time finder.
 *
 * Pick which collective members, a duration, and a date range; see the times
 * when at least 2+ of the selected members are mutually free. Click a row to
 * create a Google Calendar event on the primary host's calendar with the
 * other selected members as attendees.
 *
 * Reads each host's working_hours + availability_overrides from wv-booking
 * via the site's internal endpoints (see port/lib/booking/site-internal.ts).
 */

import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { listHosts } from "@/lib/booking/queries";
import { FindATimeClient } from "./components/find-a-time-client";

export const dynamic = "force-dynamic";

export default async function FindATimePage() {
  const hosts = await listHosts();

  return (
    <div>
      <PageHeader
        title="find a time"
        description="pick members + duration → see when 2+ of you are free → click to schedule a google calendar event."
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← bookings
        </Link>
      </PageHeader>

      <FindATimeClient
        hosts={hosts.map((h) => ({
          id: h.id,
          slug: h.slug,
          display_name: h.display_name,
        }))}
      />
    </div>
  );
}
