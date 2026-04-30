/**
 * POST /api/booking/reschedule/commit
 *
 * Token-authenticated. Atomically moves the booking's `during` to a new
 * range, patches the Google Calendar event (preserving Meet link + RSVPs),
 * and notifies visitor + host.
 *
 * Body: { token, newStart }.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  mintCancelToken,
  mintRescheduleToken,
  verifyRescheduleToken,
} from "@/lib/booking/sign";
import {
  selectOne,
  select,
  update,
  parseTstzrange,
  tstzrange,
  SupabaseError,
} from "@/lib/booking/supabase";
import type { Booking, EventType, Host } from "@/lib/booking/supabase";
import { patchCalendarEvent } from "@/lib/booking/gcal-events";
import {
  sendRescheduleNotifications,
  type RescheduleEmailContext,
} from "@/lib/booking/email";

export async function POST(req: NextRequest) {
  let raw: { token?: unknown; newStart?: unknown };
  try {
    raw = (await req.json()) as { token?: unknown; newStart?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const token = typeof raw.token === "string" ? raw.token : "";
  const newStartStr = typeof raw.newStart === "string" ? raw.newStart : "";
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  let bid: string;
  try {
    const payload = await verifyRescheduleToken(token);
    bid = payload.bid;
  } catch (err) {
    console.warn("[booking.reschedule.commit] token verify failed:", String(err));
    return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
  }

  const newStart = new Date(newStartStr);
  if (isNaN(+newStart)) {
    return NextResponse.json({ error: "invalid newStart" }, { status: 400 });
  }

  try {
    const booking = await selectOne<Booking>(
      "bookings",
      `id=eq.${bid}&select=*`,
    );
    if (!booking) {
      return NextResponse.json({ error: "booking not found" }, { status: 404 });
    }
    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "booking already cancelled" },
        { status: 410 },
      );
    }

    const eventType = await selectOne<EventType>(
      "event_types",
      `id=eq.${booking.event_type_id}&select=*`,
    );
    if (!eventType) {
      return NextResponse.json({ error: "event type missing" }, { status: 500 });
    }

    // Validate horizon + notice for the NEW time.
    const now = new Date();
    const earliest = new Date(+now + eventType.notice_min * 60_000);
    const latest = new Date(+now + eventType.horizon_days * 86_400_000);
    if (+newStart < +earliest) {
      return NextResponse.json(
        { error: "too soon to book this slot" },
        { status: 400 },
      );
    }
    if (+newStart > +latest) {
      return NextResponse.json(
        { error: "outside the booking window" },
        { status: 400 },
      );
    }

    const newEnd = new Date(+newStart + eventType.duration_min * 60_000);
    const newDuring = tstzrange(newStart, newEnd);

    // Atomic move — the EXCLUDE constraint on bookings rejects overlapping
    // confirmed rows on the same host, so PostgREST raises 23P01 if the
    // new slot is taken.
    let moved: Booking[] = [];
    try {
      moved = await update<Booking>(
        "bookings",
        `id=eq.${bid}&status=eq.confirmed`,
        { during: newDuring, status: "confirmed", cancelled_at: null },
      );
    } catch (err) {
      if (err instanceof SupabaseError && err.code === "23P01") {
        console.warn("[booking.reschedule.commit] exclusion violation");
        return NextResponse.json(
          { error: "slot just taken" },
          { status: 409 },
        );
      }
      throw err;
    }
    if (moved.length === 0) {
      return NextResponse.json(
        { error: "booking not in a reschedulable state" },
        { status: 409 },
      );
    }

    const updated = moved[0];
    const oldRange = parseTstzrange(booking.during);

    // Patch the Google Calendar event (best-effort; non-fatal).
    if (booking.google_event_id) {
      try {
        await patchCalendarEvent({
          hostId: booking.assigned_host_id,
          eventId: booking.google_event_id,
          start: newStart,
          end: newEnd,
          timezone: booking.visitor_tz,
        });
      } catch (err) {
        console.error("[booking.reschedule.commit] gcal patch failed:", err);
      }
    }

    // Build email context — needs fresh URLs since tokens may have rotated.
    try {
      const involved = [
        updated.assigned_host_id,
        ...(updated.collective_host_ids ?? []),
      ].filter((id, i, arr) => arr.indexOf(id) === i);
      const hosts =
        involved.length > 0
          ? await select<Host>(
              "hosts",
              `id=in.(${involved.join(",")})&select=id,display_name,email`,
            )
          : [];
      const hostNames = involved
        .map((id) => hosts.find((h) => h.id === id)?.display_name)
        .filter((n): n is string => typeof n === "string");
      const hostEmails = involved
        .map((id) => hosts.find((h) => h.id === id)?.email)
        .filter((e): e is string => typeof e === "string");

      const origin = new URL(req.url).origin;
      const [cancelToken, newRescheduleToken] = await Promise.all([
        mintCancelToken(updated.id),
        mintRescheduleToken(updated.id),
      ]);
      const cancelUrl = `${origin}/book/${eventType.slug}/cancel?token=${encodeURIComponent(cancelToken)}`;
      const rescheduleUrl = `${origin}/book/${eventType.slug}/reschedule?token=${encodeURIComponent(newRescheduleToken)}`;

      const ctx: RescheduleEmailContext = {
        visitorName: updated.visitor_name,
        visitorEmail: updated.visitor_email,
        visitorTz: updated.visitor_tz,
        hostNames,
        hostEmails,
        eventTitle: eventType.title,
        startAt: newStart,
        endAt: newEnd,
        durationMin: eventType.duration_min,
        meetUrl: updated.meet_url,
        cancelUrl,
        rescheduleUrl,
        oldStartAt: oldRange.start,
        oldEndAt: oldRange.end,
      };
      await sendRescheduleNotifications(ctx).catch((err) =>
        console.error("[booking.reschedule.commit] email failed:", err),
      );
    } catch (err) {
      console.error("[booking.reschedule.commit] notification setup failed:", err);
    }

    return NextResponse.json({
      ok: true,
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
    });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.reschedule.commit] supabase error:", err.message, err.code);
    } else {
      console.error("[booking.reschedule.commit] unexpected:", err);
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
