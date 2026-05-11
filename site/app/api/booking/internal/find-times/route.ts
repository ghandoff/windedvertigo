/**
 * POST /api/booking/internal/find-times
 *
 * Internal endpoint for the port's "find a time" panel. Computes mutual-free
 * windows of a given duration across a set of hosts (by slug), respecting
 * each host's working_hours and availability_overrides.
 *
 * Auth: Bearer <BOOKING_INTERNAL_TOKEN> in the Authorization header. The
 * port worker holds the same secret as a wrangler env var.
 *
 * Request body:
 *   {
 *     hostSlugs: string[];     // 1+ slugs from the hosts table
 *     duration: number;        // minutes
 *     fromIso: string;         // ISO timestamp
 *     toIso: string;           // ISO timestamp; range capped at 60 days
 *     minRequired?: number;    // default = hostSlugs.length (all must be free)
 *   }
 *
 * Returns: { windows, hosts } — see the bottom of POST() for the shape.
 */

import { NextRequest, NextResponse } from "next/server";
import { select, parseTstzrange, SupabaseError } from "@/lib/booking/supabase";
import type {
  AvailabilityOverride,
  Booking,
  Host,
} from "@/lib/booking/supabase";
import { getFreeBusyForHosts } from "@/lib/booking/freebusy";
import type { HostBusy, Interval } from "@/lib/booking/freebusy";
import { generateSlots } from "@/lib/booking/slots";

const MAX_RANGE_MS = 60 * 24 * 60 * 60 * 1000;

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

interface FindTimesBody {
  hostSlugs?: unknown;
  duration?: unknown;
  fromIso?: unknown;
  toIso?: unknown;
  minRequired?: unknown;
}

export async function POST(req: NextRequest) {
  if (!checkInternalToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: FindTimesBody;
  try {
    raw = (await req.json()) as FindTimesBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const slugs = Array.isArray(raw.hostSlugs)
    ? raw.hostSlugs.filter((s): s is string => typeof s === "string")
    : [];
  if (slugs.length === 0) {
    return NextResponse.json({ error: "hostSlugs required" }, { status: 400 });
  }
  const duration = Number(raw.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration % 5 !== 0) {
    return NextResponse.json({ error: "invalid duration" }, { status: 400 });
  }
  const fromIso = typeof raw.fromIso === "string" ? raw.fromIso : "";
  const toIso = typeof raw.toIso === "string" ? raw.toIso : "";
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (isNaN(+from) || isNaN(+to) || +to <= +from) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }
  if (+to - +from > MAX_RANGE_MS) {
    return NextResponse.json({ error: "range too large (max 60 days)" }, { status: 400 });
  }
  const minRequiredRaw = Number(raw.minRequired);
  const minRequired =
    Number.isFinite(minRequiredRaw) && minRequiredRaw >= 1
      ? Math.min(slugs.length, Math.floor(minRequiredRaw))
      : slugs.length;

  try {
    const hosts = await select<Host>(
      "hosts",
      `slug=in.(${slugs.map(encodeURIComponent).join(",")})&active=eq.true&select=*`,
    );
    if (hosts.length === 0) {
      return NextResponse.json({ windows: [], hosts: [] });
    }
    const hostIds = hosts.map((h) => h.id);

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
        // skip
      }
    }

    const mergedFreeBusy: HostBusy[] = freeBusy.map((fb) => ({
      ...fb,
      busy: [...fb.busy, ...(overlayByHost[fb.hostId] ?? [])],
    }));

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

    const fakeEventType = {
      mode: "collective" as const,
      duration_min: duration,
      slot_step_min: 30,
      notice_min: 0,
      min_required: minRequired,
    };

    const slots = generateSlots({
      eventType: fakeEventType,
      hosts,
      freeBusy: mergedFreeBusy,
      overrides: { blocks, extras },
      range: { start: from, end: to },
      now: new Date(),
    });

    return NextResponse.json({
      windows: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        freeHostIds: s.freeHostIds ?? [],
      })),
      hosts: hosts.map((h) => ({
        id: h.id,
        slug: h.slug,
        display_name: h.display_name,
      })),
    });
  } catch (err) {
    if (err instanceof SupabaseError) {
      console.error("[booking.internal.find-times] supabase error:", err.message);
      return NextResponse.json({ error: "database error" }, { status: 500 });
    }
    console.error("[booking.internal.find-times] unexpected:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
