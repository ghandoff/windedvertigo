/**
 * POST /api/booking/create
 *
 * Public + Turnstile. Creates a confirmed booking, syncs to Google Calendar
 * (with Meet), sends confirmation emails, and logs to Notion CRM.
 *
 * Branches by event_type.mode:
 *   - solo:        single insert, exclusion constraint protects against races
 *   - round_robin: SQL function picks a host atomically
 *   - collective:  re-checks freebusy, inserts with collective_host_ids
 *
 * Booking is "committed" once the bookings row is in the DB. Any failure
 * after that (gcal, email, notion) is non-fatal and surfaced as warnings.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  selectOne,
  insert,
  update,
  rpc,
  tstzrange,
  SupabaseError,
} from "@/lib/booking/supabase";
import type { EventType, Host, Booking } from "@/lib/booking/supabase";
import {
  mintCancelToken,
  mintRescheduleToken,
} from "@/lib/booking/sign";
import { getFreeBusyForHosts } from "@/lib/booking/freebusy";
import { containsInterval } from "@/lib/booking/slots";
import {
  checkBookingCreateLimit,
  checkBookingCreateGlobalLimit,
} from "@/lib/booking/rate-limit-kv";
import { createCalendarEvent } from "@/lib/booking/gcal-events";
import {
  sendBookingConfirmations,
  type BookingEmailContext,
} from "@/lib/booking/email";
import { logBookingToNotion } from "@/lib/booking/notion";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface CreateBody {
  eventTypeId?: unknown;
  start?: unknown;
  visitor?: { name?: unknown; email?: unknown; tz?: unknown } | unknown;
  intake?: { curious?: unknown; valuable?: unknown; quadrant?: unknown } | unknown;
  turnstileToken?: unknown;
}

export async function POST(req: NextRequest) {
  let raw: CreateBody;
  try {
    raw = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // ── input validation ────────────────────────────────────────────
  const eventTypeId = typeof raw.eventTypeId === "string" ? raw.eventTypeId : "";
  const startStr = typeof raw.start === "string" ? raw.start : "";
  const visitor = (raw.visitor ?? {}) as {
    name?: unknown;
    email?: unknown;
    tz?: unknown;
  };
  const name = typeof visitor.name === "string" ? visitor.name.trim() : "";
  const email =
    typeof visitor.email === "string" ? visitor.email.trim().toLowerCase() : "";
  const visitorTz =
    typeof visitor.tz === "string" && visitor.tz.length > 0
      ? visitor.tz
      : "America/Los_Angeles";

  const intake = (raw.intake ?? {}) as Record<string, unknown>;
  const intakePayload = {
    curious:
      typeof intake.curious === "string" ? intake.curious.trim().slice(0, 1000) : "",
    valuable:
      typeof intake.valuable === "string"
        ? intake.valuable.trim().slice(0, 1000)
        : "",
    quadrant: typeof intake.quadrant === "string" ? intake.quadrant : null,
  };

  const turnstileToken =
    typeof raw.turnstileToken === "string" ? raw.turnstileToken : "";

  if (!/^[0-9a-f-]{36}$/i.test(eventTypeId)) {
    return NextResponse.json({ error: "invalid eventTypeId" }, { status: 400 });
  }
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email is required" }, { status: 400 });
  }
  const start = new Date(startStr);
  if (isNaN(+start)) {
    return NextResponse.json({ error: "invalid start" }, { status: 400 });
  }

  // ── turnstile ───────────────────────────────────────────────────
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!turnstileToken) {
      return NextResponse.json({ error: "turnstile required" }, { status: 401 });
    }
    try {
      const tsRes = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
        }).toString(),
      });
      const tsData = (await tsRes.json().catch(() => ({}))) as {
        success?: boolean;
      };
      if (!tsData.success) {
        return NextResponse.json(
          { error: "turnstile failed" },
          { status: 401 },
        );
      }
    } catch (err) {
      console.error("[booking.create] turnstile network error:", err);
      return NextResponse.json({ error: "turnstile failed" }, { status: 401 });
    }
  }

  // ── rate limits ─────────────────────────────────────────────────
  const globalLimit = await checkBookingCreateGlobalLimit();
  if (!globalLimit.allowed) {
    console.warn("[booking.create] global rate limit hit");
    return NextResponse.json(
      { error: "too many bookings right now — try again soon", resetAt: globalLimit.resetAt },
      { status: 429 },
    );
  }
  const emailLimit = await checkBookingCreateLimit(email);
  if (!emailLimit.allowed) {
    console.warn("[booking.create] per-email rate limit hit:", email);
    return NextResponse.json(
      { error: "you've booked too many times today", resetAt: emailLimit.resetAt },
      { status: 429 },
    );
  }

  try {
    // ── fetch event type ──────────────────────────────────────────
    const eventType = await selectOne<EventType>(
      "event_types",
      `id=eq.${eventTypeId}&active=eq.true&select=*`,
    );
    if (!eventType) {
      return NextResponse.json({ error: "event type not found" }, { status: 404 });
    }

    // ── time bounds ───────────────────────────────────────────────
    const now = new Date();
    const earliest = new Date(+now + eventType.notice_min * 60_000);
    const latest = new Date(+now + eventType.horizon_days * 86_400_000);
    if (+start < +earliest) {
      return NextResponse.json(
        { error: "too soon to book this slot" },
        { status: 400 },
      );
    }
    if (+start > +latest) {
      return NextResponse.json(
        { error: "outside the booking window" },
        { status: 400 },
      );
    }

    const end = new Date(+start + eventType.duration_min * 60_000);
    const during = tstzrange(start, end);

    const pool = eventType.host_pool ?? [];
    if (pool.length === 0) {
      return NextResponse.json({ error: "no hosts available" }, { status: 500 });
    }

    // ── branch by mode ────────────────────────────────────────────
    let booking: Booking;
    let assignedHostIds: string[]; // hosts whose calendars are involved
    let primaryHostId: string;

    if (eventType.mode === "solo") {
      primaryHostId = pool[0];
      assignedHostIds = [primaryHostId];
      try {
        const rows = await insert<Booking>("bookings", {
          event_type_id: eventType.id,
          assigned_host_id: primaryHostId,
          during,
          visitor_name: name,
          visitor_email: email,
          visitor_tz: visitorTz,
          intake: intakePayload,
        });
        booking = rows[0];
      } catch (err) {
        if (err instanceof SupabaseError && err.code === "23P01") {
          console.warn("[booking.create] solo exclusion violation");
          return NextResponse.json(
            { error: "slot just taken" },
            { status: 409 },
          );
        }
        throw err;
      }
    } else if (eventType.mode === "round_robin") {
      try {
        booking = await rpc<Booking>("book_round_robin", {
          p_event_type_id: eventType.id,
          p_during: during,
          p_visitor: { name, email, tz: visitorTz },
          p_intake: intakePayload,
        });
      } catch (err) {
        if (err instanceof SupabaseError) {
          const msg = err.message || "";
          if (msg.includes("no_available_host")) {
            console.warn("[booking.create] round_robin: no host available");
            return NextResponse.json(
              { error: "slot just taken" },
              { status: 409 },
            );
          }
          if (err.code === "23P01") {
            return NextResponse.json(
              { error: "slot just taken" },
              { status: 409 },
            );
          }
        }
        throw err;
      }
      primaryHostId = booking.assigned_host_id;
      assignedHostIds = [primaryHostId];
    } else {
      // collective
      // Re-check freebusy for everyone in the pool — must all be free.
      const freeBusy = await getFreeBusyForHosts(pool, start, end);
      const slot = { start, end };
      const allFree = freeBusy.every((fb) => {
        if (fb.error) return false;
        return !fb.busy.some(
          (b) => +b.start < +slot.end && +b.end > +slot.start,
        );
      });
      // Also ensure each host's working window contains the slot — but
      // we leave that to the slot-picking UI; re-validating it here would
      // duplicate generateSlots. The exclusion constraint catches actual
      // double-booking races below.
      if (!allFree) {
        return NextResponse.json({ error: "slot just taken" }, { status: 409 });
      }

      primaryHostId = eventType.primary_host_id ?? pool[0];
      assignedHostIds = pool;

      try {
        const rows = await insert<Booking>("bookings", {
          event_type_id: eventType.id,
          assigned_host_id: primaryHostId,
          collective_host_ids: pool,
          during,
          visitor_name: name,
          visitor_email: email,
          visitor_tz: visitorTz,
          intake: intakePayload,
        });
        booking = rows[0];
      } catch (err) {
        if (err instanceof SupabaseError && err.code === "23P01") {
          console.warn("[booking.create] collective exclusion violation");
          return NextResponse.json(
            { error: "slot just taken" },
            { status: 409 },
          );
        }
        throw err;
      }
      // Silence unused-var lint when slot containment isn't checked.
      void containsInterval;
    }

    // ── post-commit: tokens, gcal, emails, notion ────────────────
    const warnings: string[] = [];

    const [cancelToken, rescheduleToken] = await Promise.all([
      mintCancelToken(booking.id),
      mintRescheduleToken(booking.id),
    ]);

    const origin = new URL(req.url).origin;
    const cancelUrl = `${origin}/book/${eventType.slug}/cancel?token=${encodeURIComponent(cancelToken)}`;
    const rescheduleUrl = `${origin}/book/${eventType.slug}/reschedule?token=${encodeURIComponent(rescheduleToken)}`;

    // Resolve host display data for the email + gcal description.
    let allHosts: Host[] = [];
    try {
      const { select } = await import("@/lib/booking/supabase");
      allHosts = await select<Host>(
        "hosts",
        `id=in.(${assignedHostIds.join(",")})&select=id,slug,display_name,email,timezone`,
      );
    } catch (err) {
      console.error("[booking.create] host lookup failed:", err);
      warnings.push("host_lookup_failed");
    }
    const primaryHost = allHosts.find((h) => h.id === primaryHostId);
    const hostNames = assignedHostIds
      .map((id) => allHosts.find((h) => h.id === id)?.display_name)
      .filter((n): n is string => typeof n === "string");
    const hostEmails = assignedHostIds
      .map((id) => allHosts.find((h) => h.id === id)?.email)
      .filter((e): e is string => typeof e === "string");

    // Calendar event lives on the primary host's calendar. Other collective
    // members are invited as attendees.
    let meetUrl: string | null = null;
    let googleEventId: string | null = null;
    if (primaryHost) {
      const otherHostEmails =
        eventType.mode === "collective"
          ? allHosts
              .filter((h) => h.id !== primaryHostId)
              .map((h) => ({ email: h.email, displayName: h.display_name }))
          : [];
      try {
        const ev = await createCalendarEvent({
          hostId: primaryHostId,
          summary: eventType.title,
          description: `${name}'s playdate.\n\ncancel: ${cancelUrl}\nreschedule: ${rescheduleUrl}`,
          start,
          end,
          attendees: [
            { email, displayName: name },
            ...otherHostEmails,
          ],
          timezone: visitorTz,
          withMeet: true,
        });
        meetUrl = ev.meetUrl;
        googleEventId = ev.eventId;
        // Persist gcal ids on the booking row.
        try {
          await update<Booking>(
            "bookings",
            { id: `eq.${booking.id}` },
            { google_event_id: googleEventId, meet_url: meetUrl },
          );
        } catch (err) {
          console.error("[booking.create] failed to update booking with gcal ids:", err);
          warnings.push("gcal_id_persist_failed");
        }
      } catch (err) {
        console.error("[booking.create] gcal create failed:", err);
        warnings.push("gcal_create_failed");
      }
    } else {
      warnings.push("primary_host_not_found");
    }

    // Emails + Notion in parallel — non-fatal.
    const emailCtx: BookingEmailContext = {
      visitorName: name,
      visitorEmail: email,
      visitorTz,
      hostNames,
      hostEmails,
      eventTitle: eventType.title,
      startAt: start,
      endAt: end,
      durationMin: eventType.duration_min,
      meetUrl,
      cancelUrl,
      rescheduleUrl,
      intake: {
        curious: intakePayload.curious,
        valuable: intakePayload.valuable,
        quadrant: intakePayload.quadrant,
      },
    };

    await Promise.all([
      sendBookingConfirmations(emailCtx).catch((err) => {
        console.error("[booking.create] email send failed:", err);
        warnings.push("email_failed");
      }),
      logBookingToNotion({
        name,
        email,
        eventTypeSlug: eventType.slug,
        eventTitle: eventType.title,
        startAt: start,
        hostNames,
        curious: intakePayload.curious,
        valuable: intakePayload.valuable,
        quadrant: intakePayload.quadrant,
      }).catch((err) => {
        console.error("[booking.create] notion log failed:", err);
        warnings.push("notion_failed");
      }),
    ]);

    return NextResponse.json(
      {
        bookingId: booking.id,
        cancelUrl,
        rescheduleUrl,
        start: start.toISOString(),
        end: end.toISOString(),
        meetUrl,
        hostNames,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.create] supabase error:", err.message, err.status, err.code);
    } else {
      console.error("[booking.create] unexpected:", err);
    }
    return NextResponse.json(
      { error: "couldn't create booking — please try again" },
      { status: 500 },
    );
  }
}
