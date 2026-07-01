/**
 * /book/poll/[slug] — anonymous respond page for a group availability poll.
 *
 * Loads poll metadata + current tally server-side; interactive form is a
 * client component that POSTs to /api/poll/[slug]/respond.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { select, selectOne } from "@/lib/booking/supabase";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PollRespondForm } from "./poll-respond-form";
import { PollResultsGrid } from "./poll-results-grid";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

interface Poll {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  locked_option_id: string | null;
  created_at: string;
}

interface PollOption {
  id: string;
  poll_id: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
}

interface PollResponse {
  id: string;
  poll_id: string;
  respondent_name: string;
  created_at: string;
}

interface PollResponseChoice {
  id: string;
  response_id: string;
  option_id: string;
  availability: "yes" | "if_need_be" | "no";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const poll = await selectOne<Poll>("polls", { slug: `eq.${slug}` });
    if (poll) {
      return {
        title: `${poll.title} · group poll · winded.vertigo`,
        description: poll.description ?? "pick the times that work for you.",
        robots: { index: false, follow: false },
      };
    }
  } catch {}
  return { title: "group poll · winded.vertigo", robots: { index: false, follow: false } };
}

export default async function PollRespondPage({ params }: Props) {
  const { slug } = await params;

  const poll = await selectOne<Poll>("polls", { slug: `eq.${slug}` });
  if (!poll) notFound();

  const [options, responses] = await Promise.all([
    select<PollOption>("poll_options", `poll_id=eq.${poll.id}&order=sort_order.asc`),
    select<PollResponse>("poll_responses", `poll_id=eq.${poll.id}&order=created_at.asc`),
  ]);

  const responseIds = responses.map((r) => r.id);
  const realChoices =
    responseIds.length > 0
      ? await select<PollResponseChoice>(
          "poll_response_choices",
          `response_id=in.(${responseIds.join(",")})`,
        )
      : [];

  const locked = poll.locked_option_id
    ? options.find((o) => o.id === poll.locked_option_id) ?? null
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-12">
        <div className="mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">group playdate</p>
          <h1 className="text-2xl font-semibold">{poll.title}</h1>
          {poll.description && (
            <p className="mt-2 text-sm text-muted-foreground">{poll.description}</p>
          )}
          {locked && (
            <div className="mt-4 rounded-md border border-green-400/60 bg-green-50/30 dark:bg-green-950/10 p-3 text-sm">
              <span className="font-medium text-green-700 dark:text-green-400">time confirmed: </span>
              <span className="text-muted-foreground">
                {formatSlotLocal(locked.starts_at, locked.ends_at)}
              </span>
            </div>
          )}
        </div>

        <PollResultsGrid
          options={options}
          responses={responses}
          choices={realChoices}
          lockedOptionId={poll.locked_option_id}
        />

        {!poll.locked_option_id && (
          <div className="mt-8 rounded-md border p-6">
            <h2 className="text-sm font-medium mb-4">add your availability</h2>
            <PollRespondForm
              pollSlug={slug}
              options={options}
              existingResponseCount={responses.length}
            />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function formatSlotLocal(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  // Server renders in UTC; client will hydrate with local timezone via the client component
  const date = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${t1}–${t2}`;
}
