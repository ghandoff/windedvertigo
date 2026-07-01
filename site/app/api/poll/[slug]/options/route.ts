/**
 * POST /api/poll/[slug]/options
 *
 * Allows a respondent to propose an additional time slot on a poll.
 * Inserts a new poll_option row and returns it so the client can immediately
 * display it and let the proposer vote on it.
 *
 * Body: { startsAt: string (ISO); endsAt: string (ISO) }
 * Auth: none — anon insert permitted by RLS on poll_options.
 */

import { NextRequest, NextResponse } from "next/server";
import { select, selectOne, insert } from "@/lib/booking/supabase";

interface Poll { id: string; locked_option_id: string | null }
interface PollOption { id: string; poll_id: string; starts_at: string; ends_at: string; sort_order: number }

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

  const { startsAt, endsAt } = body as { startsAt?: unknown; endsAt?: unknown };

  if (!startsAt || typeof startsAt !== "string") {
    return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
  }
  if (!endsAt || typeof endsAt !== "string") {
    return NextResponse.json({ error: "endsAt is required" }, { status: 400 });
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "invalid date values" }, { status: 400 });
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
  }

  const poll = await selectOne<Poll>("polls", { slug: `eq.${slug}` }).catch(() => null);
  if (!poll) return NextResponse.json({ error: "poll not found" }, { status: 404 });
  if (poll.locked_option_id) return NextResponse.json({ error: "this poll is locked" }, { status: 409 });

  // Determine the next sort_order
  const existing = await select<PollOption>("poll_options", `poll_id=eq.${poll.id}&order=sort_order.desc&limit=1`).catch(() => []);
  const nextOrder = existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const [option] = await insert<PollOption>("poll_options", {
    poll_id: poll.id,
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    sort_order: nextOrder,
  });

  return NextResponse.json({ ok: true, option });
}
