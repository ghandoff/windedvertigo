/**
 * POST /api/poll/[slug]/respond
 *
 * Accepts an anonymous availability response for a group poll.
 * Creates a poll_response row + one poll_response_choice per option.
 * After insert, notifies the poll organiser via email (fire-and-forget).
 *
 * Body: { name: string; choices: Record<optionId, "yes"|"if_need_be"|"no"> }
 * Auth: none — anonymous submission, RLS allows anon insert.
 */

import { NextRequest, NextResponse } from "next/server";
import { select, selectOne, insert } from "@/lib/booking/supabase";
import { sendPollResponseNotification } from "@/lib/booking/email";

type Availability = "yes" | "if_need_be" | "no";
const VALID_AVAIL = new Set<Availability>(["yes", "if_need_be", "no"]);

interface Poll { id: string; slug: string; title: string; locked_option_id: string | null; created_by_host_id: string | null }
interface PollOption { id: string; poll_id: string }
interface PollResponse { id: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { name, choices } = body as { name?: unknown; choices?: unknown };

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!choices || typeof choices !== "object" || Array.isArray(choices)) {
    return NextResponse.json({ error: "choices must be an object mapping optionId → availability" }, { status: 400 });
  }

  // validate availability values
  for (const [, v] of Object.entries(choices as Record<string, unknown>)) {
    if (!VALID_AVAIL.has(v as Availability)) {
      return NextResponse.json({ error: `invalid availability value: ${v}` }, { status: 400 });
    }
  }

  // load poll
  const poll = await selectOne<Poll>("polls", { slug: `eq.${slug}` }).catch(() => null);
  if (!poll) return NextResponse.json({ error: "poll not found" }, { status: 404 });
  if (poll.locked_option_id) return NextResponse.json({ error: "this poll is locked" }, { status: 409 });

  // validate that submitted option IDs actually belong to this poll
  const options = await select<PollOption>("poll_options", `poll_id=eq.${poll.id}`).catch(() => []);
  const validOptionIds = new Set(options.map((o) => o.id));
  const submittedOptionIds = Object.keys(choices as Record<string, string>);
  for (const id of submittedOptionIds) {
    if (!validOptionIds.has(id)) {
      return NextResponse.json({ error: `unknown option: ${id}` }, { status: 400 });
    }
  }

  // insert response
  const [response] = await insert<PollResponse>("poll_responses", {
    poll_id: poll.id,
    respondent_name: name.trim().slice(0, 100),
  });

  // insert choices
  const choiceRows = submittedOptionIds.map((optionId) => ({
    response_id: response.id,
    option_id: optionId,
    availability: (choices as Record<string, Availability>)[optionId],
  }));

  if (choiceRows.length > 0) {
    await insert("poll_response_choices", choiceRows);
  }

  // notify the poll organiser (best-effort — don't fail the response if this errors)
  if (poll.created_by_host_id) {
    try {
      const [host] = await select<{ email: string; display_name: string }>(
        "hosts",
        `id=eq.${poll.created_by_host_id}`,
      );
      if (host?.email) {
        // Count total responses for this poll (including the one just inserted)
        const allResponses = await select<{ id: string }>(
          "poll_responses",
          `poll_id=eq.${poll.id}`,
        ).catch(() => []);
        const portOrigin = process.env.PORT_ORIGIN ?? "https://port.windedvertigo.com";
        await sendPollResponseNotification({
          pollTitle: poll.title,
          respondentName: name.trim(),
          portPollUrl: `${portOrigin}/bookings/polls/${poll.id}`,
          hostEmail: host.email,
          responseCount: allResponses.length,
        });
      }
    } catch (err) {
      console.error("[poll/respond] notification failed:", err);
    }
  }

  return NextResponse.json({ ok: true, responseId: response.id });
}
