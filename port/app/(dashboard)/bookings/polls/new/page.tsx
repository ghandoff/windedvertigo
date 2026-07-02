/**
 * /bookings/polls/new — create a group availability poll.
 *
 * Host picks a title, optional description, and a set of discrete candidate
 * slots. On submit a shareable /book/poll/[slug] link is generated.
 */

import { PageHeader } from "@/app/components/page-header";
import Link from "next/link";
import { CreatePollForm } from "./create-poll-form";
import { listHosts, getHostByEmail } from "@/lib/booking/queries";
import { suggestCollectiveSlots } from "@/lib/booking/collective-slots";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; fromTime?: string; toTime?: string }>;
}

export default async function NewPollPage({ searchParams }: Props) {
  const { from, to, fromTime, toTime } = await searchParams;

  // Parse date range from URL params; fall back to the default 28-day window.
  let startDate: Date | undefined;
  let daysAhead = 28;
  if (from) {
    const parsed = new Date(`${from}T12:00:00`);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
      if (to) {
        const endParsed = new Date(`${to}T12:00:00`);
        if (!isNaN(endParsed.getTime()) && endParsed > parsed) {
          daysAhead = Math.max(1, Math.min(180, Math.round((endParsed.getTime() - parsed.getTime()) / 86_400_000)));
        }
      }
    }
  }

  // Resolve the logged-in creator's host record for timezone + display hours.
  const session = await auth();
  const creatorHost = session?.user?.email
    ? await getHostByEmail(session.user.email).catch(() => null)
    : null;

  const hosts = await listHosts({ activeOnly: true }).catch(() => []);
  const suggestedSlots = suggestCollectiveSlots(
    hosts,
    daysAhead,
    startDate,
    creatorHost ?? undefined,
    fromTime,
    toTime,
  );

  return (
    <div>
      <PageHeader
        title="new group poll"
        description="pick a few candidate times — share the link and let everyone weigh in."
      >
        <Link
          href="/bookings/polls"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← back to polls
        </Link>
      </PageHeader>

      <CreatePollForm
        suggestedSlots={suggestedSlots}
        initialFrom={from}
        initialTo={to}
        initialFromTime={fromTime}
        initialToTime={toTime}
        creatorTz={creatorHost?.timezone}
      />
    </div>
  );
}
