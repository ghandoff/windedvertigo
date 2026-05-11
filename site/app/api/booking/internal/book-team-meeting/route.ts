import { NextRequest, NextResponse } from "next/server";
import { selectOne, select, SupabaseError } from "@/lib/booking/supabase";
import type { Host } from "@/lib/booking/supabase";
import { createCalendarEvent } from "@/lib/booking/gcal-events";

function checkInternalToken(req: NextRequest): boolean {
  const expected = process.env.BOOKING_INTERNAL_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return false;
  const got = m[1];
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

interface BookBody {
  primaryHostSlug?: unknown;
  attendeeHostSlugs?: unknown;
  start?: unknown;
  end?: unknown;
  title?: unknown;
  description?: unknown;
  timezone?: unknown;
  withMeet?: unknown;
}

export async function POST(req: NextRequest) {
  if (!checkInternalToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: BookBody;
  try {
    raw = (await req.json()) as BookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const primarySlug = typeof raw.primaryHostSlug === "string" ? raw.primaryHostSlug : "";
  const attendeeSlugs = Array.isArray(raw.attendeeHostSlugs)
    ? raw.attendeeHostSlugs.filter((s): s is string => typeof s === "string")
    : [];
  const startStr = typeof raw.start === "string" ? raw.start : "";
  const endStr = typeof raw.end === "string" ? raw.end : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const description = typeof raw.description === "string" ? raw.description : "";
  const timezone =
    typeof raw.timezone === "string" && raw.timezone.length > 0
      ? raw.timezone
      : "America/Los_Angeles";
  const withMeet = raw.withMeet !== false;

  if (!primarySlug) {
    return NextResponse.json({ error: "primaryHostSlug required" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(+start) || isNaN(+end) || +end <= +start) {
    return NextResponse.json({ error: "invalid start/end" }, { status: 400 });
  }

  try {
    const primary = await selectOne<Host>("hosts", `slug=eq.${primarySlug}&active=eq.true&select=*`);
    if (!primary) {
      return NextResponse.json({ error: "primary host not found" }, { status: 404 });
    }

    const attendeeHosts =
      attendeeSlugs.length > 0
        ? await select<Host>(
            "hosts",
            `slug=in.(${attendeeSlugs.map(encodeURIComponent).join(",")})&active=eq.true&select=*`,
          )
        : [];

    const result = await createCalendarEvent({
      hostId: primary.id,
      summary: title,
      description,
      start,
      end,
      attendees: attendeeHosts.map((h) => ({
        email: h.email,
        displayName: h.display_name,
      })),
      timezone,
      withMeet,
    });

    return NextResponse.json({
      eventId: result.eventId,
      htmlLink: result.htmlLink,
      meetUrl: result.meetUrl,
      primaryHost: { slug: primary.slug, display_name: primary.display_name },
      attendees: attendeeHosts.map((h) => ({ slug: h.slug, display_name: h.display_name })),
    });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.internal.book-team] supabase error:", err.message);
      return NextResponse.json({ error: "database error" }, { status: 500 });
    }
    console.error("[booking.internal.book-team] unexpected:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "internal error" },
      { status: 500 },
    );
  }
}
