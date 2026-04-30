/**
 * GET /api/booking/reschedule/verify?token=...
 *
 * Token-authenticated lookup that powers the reschedule UI: returns the
 * existing booking shape so the visitor can see what they're moving and
 * pick a new time.
 *
 * Refuses if the booking is < 4 hours away (or < notice_min if longer).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRescheduleToken } from "@/lib/booking/sign";
import {
  selectOne,
  parseTstzrange,
  SupabaseError,
} from "@/lib/booking/supabase";
import type { Booking, EventType } from "@/lib/booking/supabase";

const MIN_RESCHEDULE_LEAD_MIN = 4 * 60;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  let bid: string;
  try {
    const payload = await verifyRescheduleToken(token);
    bid = payload.bid;
  } catch (err) {
    console.warn("[booking.reschedule.verify] token verify failed:", String(err));
    return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
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
      `id=eq.${booking.event_type_id}&select=slug,notice_min`,
    );

    const range = parseTstzrange(booking.during);
    const minLead = Math.max(
      MIN_RESCHEDULE_LEAD_MIN,
      eventType?.notice_min ?? 0,
    );
    const leadMs = +range.start - Date.now();
    if (leadMs < minLead * 60_000) {
      return NextResponse.json(
        { error: "too late to reschedule" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      eventTypeSlug: eventType?.slug ?? null,
      currentStart: range.start.toISOString(),
      currentEnd: range.end.toISOString(),
      visitorName: booking.visitor_name,
      visitorEmail: booking.visitor_email,
      visitorTz: booking.visitor_tz,
    });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.reschedule.verify] supabase error:", err.message);
    } else {
      console.error("[booking.reschedule.verify] unexpected:", err);
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
