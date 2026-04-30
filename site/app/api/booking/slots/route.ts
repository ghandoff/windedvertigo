/**
 * GET /api/booking/slots?eventTypeId=...&from=...&to=...&tz=...
 *
 * Public. Returns the available slots for an event type over a date range.
 *
 * Pipeline: event_type + hosts → google freeBusy + own confirmed bookings
 * (overlay) + availability_overrides → generateSlots (pure).
 *
 * Range is capped at 60 days to bound the freeBusy fan-out.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  selectOne,
  select,
  parseTstzrange,
  SupabaseError,
} from "@/lib/booking/supabase";
import type {
  EventType,
  Host,
  Booking,
  AvailabilityOverride,
} from "@/lib/booking/supabase";
import { getFreeBusyForHosts } from "@/lib/booking/freebusy";
import type { HostBusy, Interval } from "@/lib/booking/freebusy";
import { generateSlots } from "@/lib/booking/slots";

const MAX_RANGE_MS = 60 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const eventTypeId = url.searchParams.get("eventTypeId");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const tz = url.searchParams.get("tz") || "America/Los_Angeles";

  if (!eventTypeId || !/^[0-9a-f-]{36}$/i.test(eventTypeId)) {
    return NextResponse.json({ error: "eventTypeId required" }, { status: 400 });
  }
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(+from) || isNaN(+to)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (+to <= +from) {
    return NextResponse.json({ error: "to must be after from" }, { status: 400 });
  }
  if (+to - +from > MAX_RANGE_MS) {
    return NextResponse.json({ error: "range too large (max 60 days)" }, { status: 400 });
  }

  try {
    const eventType = await selectOne<EventType>(
      "event_types",
      `id=eq.${eventTypeId}&active=eq.true&select=*`,
    );
    if (!eventType) {
      return NextResponse.json({ error: "event type not found" }, { status: 404 });
    }

    const pool = eventType.host_pool ?? [];
    if (pool.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const hosts = await select<Host>(
      "hosts",
      `id=in.(${pool.join(",")})&active=eq.true&select=*`,
    );
    if (hosts.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const hostIds = hosts.map((h) => h.id);

    // freeBusy + own bookings overlay + overrides — fetch in parallel
    const [freeBusy, ownBookings, overrides] = await Promise.all([
      getFreeBusyForHosts(hostIds, from, to),
      select<Booking>(
        "bookings",
        `assigned_host_id=in.(${hostIds.join(",")})&status=eq.confirmed&during=ov.[${from.toISOString()},${to.toISOString()}]&select=assigned_host_id,collective_host_ids,during`,
      ),
      select<AvailabilityOverride>(
        "availability_overrides",
        `host_id=in.(${hostIds.join(",")})&during=ov.[${from.toISOString()},${to.toISOString()}]&select=*`,
      ),
    ]);

    // Overlay our own confirmed bookings as additional busy intervals
    // (handles bookings not yet synced to Google's freeBusy index).
    const overlayByHost: Record<string, Interval[]> = {};
    for (const b of ownBookings) {
      try {
        const range = parseTstzrange(b.during);
        const involved = [b.assigned_host_id, ...(b.collective_host_ids ?? [])];
        for (const hid of involved) {
          if (!hostIds.includes(hid)) continue;
          (overlayByHost[hid] ??= []).push({ start: range.start, end: range.end });
        }
      } catch {
        // skip malformed
      }
    }

    const mergedFreeBusy: HostBusy[] = freeBusy.map((fb) => ({
      ...fb,
      busy: [...fb.busy, ...(overlayByHost[fb.hostId] ?? [])],
    }));

    // Split overrides into blocks/extras keyed by host_id.
    const blocks: Record<string, Interval[]> = {};
    const extras: Record<string, Interval[]> = {};
    for (const o of overrides) {
      try {
        const range = parseTstzrange(o.during);
        const target = o.kind === "block" ? blocks : extras;
        (target[o.host_id] ??= []).push({ start: range.start, end: range.end });
      } catch {
        // skip
      }
    }

    const slots = generateSlots({
      eventType,
      hosts,
      freeBusy: mergedFreeBusy,
      overrides: { blocks, extras },
      range: { start: from, end: to },
      now: new Date(),
    });

    return NextResponse.json({
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        hostHint: s.hostHint,
        freeHostIds: s.freeHostIds,
      })),
    });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.slots] supabase error:", err.message);
      return NextResponse.json({ error: "database error" }, { status: 500 });
    }
    console.error("[booking.slots] unexpected:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
