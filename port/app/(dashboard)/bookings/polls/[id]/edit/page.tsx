import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { getPollById, listPollOptions, getPollResults, listHosts, getHostByEmail } from "@/lib/booking/queries";
import { suggestCollectiveSlots } from "@/lib/booking/collective-slots";
import { auth } from "@/lib/auth";
import { EditPollForm } from "./edit-poll-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; fromTime?: string; toTime?: string }>;
}

export default async function EditPollPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from, to, fromTime, toTime } = await searchParams;

  const [poll, options] = await Promise.all([getPollById(id), listPollOptions(id)]);
  if (!poll) notFound();

  const { responses, choices } = await getPollResults(poll.id);

  // Build per-option response counts so the form can show which slots are locked
  const countByOption = new Map<string, number>();
  for (const c of choices) {
    countByOption.set(c.option_id, (countByOption.get(c.option_id) ?? 0) + 1);
  }
  const slotMeta = options.map((opt) => ({
    option: opt,
    responseCount: countByOption.get(opt.id) ?? 0,
  }));

  // Date range for the "add more slots" grid
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
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`edit · ${poll.title}`}
        description="update title, description, or time slots."
      >
        <Link
          href={`/bookings/polls/${poll.id}`}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← back to poll
        </Link>
      </PageHeader>

      <EditPollForm
        poll={poll}
        slotMeta={slotMeta}
        suggestedSlots={suggestedSlots}
        creatorTz={creatorHost?.timezone}
        initialFrom={from}
        initialTo={to}
        initialFromTime={fromTime}
        initialToTime={toTime}
      />
    </div>
  );
}
