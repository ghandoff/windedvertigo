/**
 * /bookings/polls/[id] — host view: results grid + lock/converge controls.
 *
 * Shows per-slot tallies, names on hover, best-slot highlight, and a
 * "lock this time" button that sets locked_option_id on the poll.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "../../components/copy-link-button";
import { getPollById, listPollOptions, getPollResults, computeTallies } from "@/lib/booking/queries";
import { LockPollButton } from "./lock-poll-button";

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

  return (
    <div>
      <PageHeader title={poll.title} description={poll.description ?? "group availability poll"}>
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← bookings
        </Link>
        <CopyLinkButton url={shareUrl} label="copy share link" />
      </PageHeader>

      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <span>
          share link:{" "}
          <Link href={shareUrl} target="_blank" className="underline underline-offset-2 hover:text-foreground">
            {shareUrl}
          </Link>
        </span>
        {poll.locked_option_id && (
          <Badge variant="outline" className="ml-2">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
            locked
          </Badge>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          no responses yet — share the link above to start collecting availability.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{responses.length} response{responses.length !== 1 ? "s" : ""}</p>

          {tallies.map((t) => {
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

                    {/* names on hover via title attribute — accessible + no JS needed */}
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

      {/* zero-response slots */}
      {options.length > 0 && responses.length === 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">candidate slots</p>
          {options.map((opt) => (
            <div key={opt.id} className="rounded-md border p-3 text-sm text-muted-foreground">
              {formatSlot(opt.starts_at, opt.ends_at)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
