/**
 * GET /api/booking/event-types/[slug]
 *
 * Public. Resolves an event-type slug to the metadata needed to render
 * the booking page: title, description, duration, host names, notice +
 * horizon. Returns 404 if the slug doesn't match an active event type.
 */

import { NextRequest, NextResponse } from "next/server";
import { selectOne, select, SupabaseError } from "@/lib/booking/supabase";
import type { EventType, Host } from "@/lib/booking/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug || slug.length > 80) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  try {
    const eventType = await selectOne<EventType>(
      "event_types",
      `slug=eq.${encodeURIComponent(slug)}&active=eq.true&select=*`,
    );
    if (!eventType) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const pool = eventType.host_pool ?? [];
    let hostNames: string[] = [];
    if (pool.length > 0) {
      const hosts = await select<Host>(
        "hosts",
        `id=in.(${pool.join(",")})&active=eq.true&select=id,slug,display_name`,
      );
      // preserve pool order so primary_host_id (when set) leads
      const byId = new Map(hosts.map((h) => [h.id, h]));
      hostNames = pool
        .map((id) => byId.get(id)?.display_name)
        .filter((n): n is string => typeof n === "string");
    }

    return NextResponse.json({
      id: eventType.id,
      slug: eventType.slug,
      title: eventType.title,
      description: eventType.description,
      duration_min: eventType.duration_min,
      mode: eventType.mode,
      hostNames,
      noticeHours: Math.round(eventType.notice_min / 60),
      horizonDays: eventType.horizon_days,
    });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.event-types] supabase error:", err.message, err.status);
      return NextResponse.json({ error: "database error" }, { status: 500 });
    }
    console.error("[booking.event-types] unexpected:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
