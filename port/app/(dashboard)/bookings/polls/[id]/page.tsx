/**
 * /bookings/polls/[id] — host view: results grid + lock/converge controls.
 *
 * Shows per-slot tallies, names on hover, best-slot highlight, a
 * duration recommender, and add/delete controls.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CopyLinkButton } from "../../components/copy-link-button";
import { getPollById, listPollOptions, getPollResults, computeTallies } from "@/lib/booking/queries";
import { LockPollButton } from "./lock-poll-button";
import { DurationRecommender } from "./duration-recommender";
import { DeletePollButton } from "./delete-poll-button";
import { AddSlotsForm } from "./add-slots-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function formatSlot(startsAt: string, endsAt: string, tz = "America/Los_Angeles") {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  return `${date} · ${t1}–${t2}`;
}

export default async function PollHostPage({ params }: Props) {
  const { id } = await params;
  const [poll, options] = await Promise.all([getPollById(id), listPollOptions(id)]);
  if (!poll) notFound();

  const { responses, choices } = await getPollResults(poll.id);
  const tallies = computeTallies(options, responses, choices);

  const siteOrigin = process.env.SITE_ORIGIN ?? "https://windedvertigo.com";
  const shareUrl = `${siteOrigin}/book/poll/${poll.slug}`;

  // Filter out zero-duration options (bad data guard — same as buildGrid in the public form)
  const validOptions = options.filter(
    (o) => new Date(o.starts_at).getTime() !== new Date(o.ends_at).getTime(),
  );

  return (
    <div>
      <PageHeader title={poll.title} description={poll.description ?? "group availability poll"}>
        <Link
          href="/bookings/polls"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← polls
        </Link>
        <CopyLinkButton url={shareUrl} label="copy share link" />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted-foreground">
        <span>
          share:{" "}
          <Link href={shareUrl} target="_blank" className="underline underline-offset-2 hover:text-foreground">
            {shareUrl}
          </Link>
        </span>
        {poll.locked_option_id && (
          <Badge variant="outline">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
            locked
          </Badge>
        )}
        <div className="flex items-center gap-4 ml-auto">
          <AddSlotsForm pollId={poll.id} />
          <DeletePollButton pollId={poll.id} pollTitle={poll.title} />
        </div>
      </div>

      {/* warn if any options have bad data */}
      {options.length > 0 && validOptions.length === 0 && (
        <div className="mb-4 rounded-md border border-amber-400/40 bg-amber-50/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          this poll has no valid time slots — all options have identical start and end times.
          use &ldquo;add time slots&rdquo; above to add valid options, or delete and recreate the poll.
        </div>
      )}
      {options.length > 0 && validOptions.length < options.length && validOptions.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-400/40 bg-amber-50/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {options.length - validOptions.length} zero-duration option{options.length - validOptions.length !== 1 ? "s" : ""} hidden —
          use &ldquo;add time slots&rdquo; to add valid replacements.
        </div>
      )}

      {responses.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          no responses yet — share the link above to start collecting availability.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{responses.length} response{responses.length !== 1 ? "s" : ""}</p>

          {tallies
            .filter((t) => new Date(t.option.starts_at).getTime() !== new Date(t.option.ends_at).getTime())
            .map((t) => {
              const total = t.yes + t.if_need_be + t.no;
              const isLocked = poll.locked_option_id === t.option.id;

              return (
                <div
                  key={t.option.id}
                  className={`rounded-md border p-4 ${t.isBest && !poll.locked_option_id ? "border-green-400/60 bg-green-50/20 dark:bg-green-950/10" : ""} ${isLocked ? "border-green-500 bg-green-50/30 dark:bg-green-950/20" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-sm">
                        {formatSlot(t.option.starts_at, t.option.ends_at)}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-green-600 dark:text-green-400">✓ {t.yes} yes</span>
                        <span className="text-amber-600 dark:text-amber-400">~ {t.if_need_be} if need be</span>
                        <span className="text-muted-foreground">✗ {t.no} no</span>
                      </div>

                      {t.respondents.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.respondents.map((r, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
                                r.availability === "yes"
                                  ? "border-green-300 text-green-700 dark:text-green-400"
                                  : r.availability === "if_need_be"
                                  ? "border-amber-300 text-amber-700 dark:text-amber-400"
                                  : "border-muted text-muted-foreground line-through"
                              }`}
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {t.isBest && !poll.locked_option_id && (
                        <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
                          best fit
                        </Badge>
                      )}
                      {isLocked ? (
                        <Badge className="text-xs bg-green-600">locked ✓</Badge>
                      ) : (
                        !poll.locked_option_id && total > 0 && (
                          <LockPollButton pollId={poll.id} optionId={t.option.id} />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* zero-response valid slots */}
      {validOptions.length > 0 && responses.length === 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">candidate slots</p>
          {validOptions.map((opt) => (
            <div key={opt.id} className="rounded-md border p-3 text-sm text-muted-foreground">
              {formatSlot(opt.starts_at, opt.ends_at)}
            </div>
          ))}
        </div>
      )}

      {/* Duration recommender — only shown when there are valid responses */}
      <DurationRecommender
        options={validOptions}
        responses={responses as { id: string; respondent_name: string }[]}
        choices={choices as { response_id: string; option_id: string; availability: "yes" | "if_need_be" | "no" }[]}
      />
    </div>
  );
}
