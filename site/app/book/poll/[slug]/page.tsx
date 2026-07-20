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

  return (
    <div style={{ background: "#273248", color: "#fff", minHeight: "100vh" }}>
      <SiteHeader />

      <main
        style={{
          maxWidth: "56rem",
          marginLeft: "auto",
          marginRight: "auto",
          width: "100%",
          paddingTop: "clamp(80px, 16vw, 120px)",
          paddingBottom: "4rem",
          paddingLeft: "clamp(1.25rem, 5vw, 2.5rem)",
          paddingRight: "clamp(1.25rem, 5vw, 2.5rem)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.12em",
              fontSize: 11,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            group playdate
          </p>
          <h1
            style={{
              letterSpacing: "-0.01em",
              fontSize: "clamp(1.6rem, 5vw, 2rem)",
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {poll.title}
          </h1>
          {poll.description && (
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 8 }}>
              {poll.description}
            </p>
          )}
        </div>

        {/* Grid + form (locked banner rendered client-side so it uses the viewer's timezone) */}
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
