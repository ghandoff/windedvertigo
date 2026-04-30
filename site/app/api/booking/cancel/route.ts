/**
 * POST /api/booking/cancel
 *
 * Token-authenticated. Marks a booking cancelled, deletes the Google Calendar
 * event (idempotent), and notifies visitor + host. Body: { token }.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCancelToken } from "@/lib/booking/sign";
import {
  selectOne,
  update,
  parseTstzrange,
  SupabaseError,
} from "@/lib/booking/supabase";
import type { Booking, EventType, Host } from "@/lib/booking/supabase";
import { select } from "@/lib/booking/supabase";
import { deleteCalendarEvent } from "@/lib/booking/gcal-events";
import {
  sendCancellationNotifications,
  type BookingEmailContext,
} from "@/lib/booking/email";
import { logCancellationToNotion } from "@/lib/booking/notion";

export async function POST(req: NextRequest) {
  let raw: { token?: unknown };
  try {
    raw = (await req.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const token = typeof raw.token === "string" ? raw.token : "";
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  let bid: string;
  try {
    const payload = await verifyCancelToken(token);
    bid = payload.bid;
  } catch (err) {
    console.warn("[booking.cancel] token verify failed:", String(err));
    return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
  }

  try {
    const booking = await selectOne<Booking>(
      "bookings",
      `id=eq.${bid}&select=*`,
    );
    if (!booking) {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
    if (booking.status === "cancelled") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    // Mark cancelled.
    const cancelledAt = new Date().toISOString();
    await update<Booking>(
      "bookings",
      { id: `eq.${bid}` },
      { status: "cancelled", cancelled_at: cancelledAt },
    );

    // Delete the calendar event (only the primary host owns it).
    if (booking.google_event_id) {
      try {
        await deleteCalendarEvent(booking.assigned_host_id, booking.google_event_id);
      } catch (err) {
        console.error("[booking.cancel] gcal delete failed:", err);
      }
    }

    // Best-effort: send cancellation emails + log to Notion.
    try {
      const eventType = await selectOne<EventType>(
        "event_types",
        `id=eq.${booking.event_type_id}&select=*`,
      );
      const involved = [
        booking.assigned_host_id,
        ...(booking.collective_host_ids ?? []),
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

      const range = parseTstzrange(booking.during);

      const ctx: BookingEmailContext = {
        visitorName: booking.visitor_name,
        visitorEmail: booking.visitor_email,
        visitorTz: booking.visitor_tz,
        hostNames,
        hostEmails,
        eventTitle: eventType?.title ?? "playdate",
        startAt: range.start,
        endAt: range.end,
        durationMin: Math.round((+range.end - +range.start) / 60_000),
        meetUrl: booking.meet_url,
        cancelUrl: "",
        rescheduleUrl: "",
      };

      await Promise.all([
        sendCancellationNotifications(ctx).catch((err) =>
          console.error("[booking.cancel] email failed:", err),
        ),
        logCancellationToNotion({
          email: booking.visitor_email,
          eventTitle: eventType?.title ?? "playdate",
          startAt: range.start,
        }).catch((err) =>
          console.error("[booking.cancel] notion log failed:", err),
        ),
      ]);
    } catch (err) {
      console.error("[booking.cancel] post-cancel notifications error:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.cancel] supabase error:", err.message);
    } else {
      console.error("[booking.cancel] unexpected:", err);
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
