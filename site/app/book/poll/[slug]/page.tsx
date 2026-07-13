/**
 * /book/poll/[slug] — public respond page for a group availability poll.
 *
 * Dark-themed, Doodle-style calendar grid. Passes existing choices to the
 * client grid so it can render a heat-map without a re-fetch after submit.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { select, selectOne } from "@/lib/booking/supabase";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PollRespondForm } from "./poll-respond-form";

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
}

interface PollResponseChoice {
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
  return {
    title: "group poll · winded.vertigo",
    robots: { index: false, follow: false },
  };
}

export default async function PollRespondPage({ params }: Props) {
  const { slug } = await params;

  const poll = await selectOne<Poll>("polls", { slug: `eq.${slug}` });
  if (!poll) notFound();

  const [options, responses] = await Promise.all([
    select<PollOption>("poll_options", `poll_id=eq.${poll.id}&order=sort_order.asc`),
    select<PollResponse>("poll_responses", `poll_id=eq.${poll.id}`),
  ]);

  const responseIds = responses.map((r) => r.id);
  const existingChoices =
    responseIds.length > 0
      ? await select<PollResponseChoice>(
          "poll_response_choices",
          `response_id=in.(${responseIds.join(",")})`,
        )
      : [];

  const locked =
    poll.locked_option_id
      ? options.find((o) => o.id === poll.locked_option_id) ?? null
      : null;

  function formatLocked(opt: PollOption) {
    const start = new Date(opt.starts_at);
    const end = new Date(opt.ends_at);
    return `${start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}–${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }

  return (
    <div style={{ background: "#273248", color: "#fff", minHeight: "100vh" }}>
      <SiteHeader />

      <main
        className="mx-auto w-full max-w-4xl px-4 pb-16"
        // NOTE: this site uses a static utility stylesheet (styles/main.css), not
        // Tailwind's JIT — so max-w-*/px-* utilities are no-ops here. Set the
        // container width/centering/gutters inline so they actually apply.
        style={{
          paddingTop: 120,
          paddingBottom: 64,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: "56rem",
          marginLeft: "auto",
          marginRight: "auto",
          width: "100%",
        }}
      >
        {/* Header */}
        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}
          >
            group playdate
          </p>
          <h1 className="text-3xl font-bold lowercase" style={{ letterSpacing: "-0.01em" }}>
            {poll.title}
          </h1>
          {poll.description && (
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              {poll.description}
            </p>
          )}
        </div>

        {/* Locked banner */}
        {locked && (
          <div
            className="mb-6 rounded-xl px-5 py-4"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: "#86efac" }}>
              time confirmed ✓
            </p>
            <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              {formatLocked(locked)}
            </p>
          </div>
        )}

        {/* Grid + form */}
        <PollRespondForm
          pollSlug={slug}
          options={options}
          existingChoices={existingChoices.map((c) => ({
            option_id: c.option_id,
            availability: c.availability,
          }))}
          totalResponses={responses.length}
          lockedOptionId={poll.locked_option_id}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
