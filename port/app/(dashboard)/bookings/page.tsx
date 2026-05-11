/**
 * /bookings — team-side dashboard for the wv-booking system.
 *
 * Reads directly from the wv-booking Supabase project. Defaults to upcoming
 * bookings (next 30 days). Filters: host, event type, status, free-text search.
 */

import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarClock } from "lucide-react";
import {
  listBookings,
  listEventTypes,
  listHosts,
  type BookingFilters,
} from "@/lib/booking/queries";
import { parseTstzrange } from "@/lib/booking/types";
import { ShareLinks } from "./components/share-links";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
  rescheduled: "bg-amber-400",
};

function formatRange(during: string, viewerTz: string): string {
  try {
    const { start, end } = parseTstzrange(during);
    const date = start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: viewerTz,
    });
    const time = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: viewerTz,
    });
    const endTime = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: viewerTz,
    });
    return `${date} · ${time}–${endTime}`;
  } catch {
    return during;
  }
}

export default async function BookingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = params.view ?? "upcoming";

  const filters: BookingFilters = {};
  if (params.host) filters.hostId = params.host;
  if (params.eventType) filters.eventTypeId = params.eventType;
  if (params.status) filters.status = params.status as BookingFilters["status"];
  if (params.search) filters.search = params.search;

  const now = new Date();
  if (view === "upcoming") {
    filters.fromIso = now.toISOString();
    filters.status = filters.status ?? "confirmed";
  } else if (view === "past") {
    filters.untilIso = now.toISOString();
  }

  const [bookings, hosts, eventTypes] = await Promise.all([
    listBookings(filters, { limit: 200 }),
    listHosts(),
    listEventTypes({ activeOnly: false }),
  ]);

  const hostById = new Map(hosts.map((h) => [h.id, h]));
  const eventTypeById = new Map(eventTypes.map((e) => [e.id, e]));
  const viewerTz = "America/Los_Angeles";

  return (
    <div>
      <PageHeader
        title="bookings"
        description="upcoming playdates booked through windedvertigo.com — pulled live from the wv-booking supabase project."
      >
        <Link
          href="/bookings/availability"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          edit availability
        </Link>
        <Link
          href="/bookings/event-types"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          event types
        </Link>
        <Link
          href="/bookings/connect"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          calendar connections
        </Link>
      </PageHeader>

      <ShareLinks eventTypes={eventTypes} />

      <div className="flex gap-2 pb-4 text-xs">
        {[
          { key: "upcoming", label: "upcoming" },
          { key: "past", label: "past" },
          { key: "all", label: "all" },
        ].map((v) => {
          const active = view === v.key;
          const next = new URLSearchParams(
            Object.entries(params).filter(([k]) => k !== "view") as [string, string][],
          );
          if (v.key !== "upcoming") next.set("view", v.key);
          return (
            <Link
              key={v.key}
              href={`/bookings${next.toString() ? `?${next.toString()}` : ""}`}
              className={
                active
                  ? "rounded-full bg-foreground text-background px-3 py-1"
                  : "rounded-full border px-3 py-1 hover:bg-muted"
              }
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="no bookings"
          description={
            view === "upcoming"
              ? "no upcoming bookings yet. once visitors book through /book/[slug], they'll appear here."
              : "no bookings match these filters."
          }
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">when</TableHead>
                <TableHead>visitor</TableHead>
                <TableHead>event</TableHead>
                <TableHead>host(s)</TableHead>
                <TableHead>status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const ev = eventTypeById.get(b.event_type_id);
                const allHostIds = [
                  b.assigned_host_id,
                  ...(b.collective_host_ids ?? []),
                ].filter((id, i, arr) => arr.indexOf(id) === i);
                const hostNames = allHostIds
                  .map((id) => hostById.get(id)?.display_name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link href={`/bookings/${b.id}`} className="block">
                        {formatRange(b.during, viewerTz)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/bookings/${b.id}`} className="block">
                        <div className="font-medium">{b.visitor_name}</div>
                        <div className="text-xs text-muted-foreground">{b.visitor_email}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/bookings/${b.id}`} className="block">
                        {ev?.title ?? b.event_type_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/bookings/${b.id}`} className="block text-sm">
                        {hostNames || "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        <span
                          className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`}
                        />
                        {b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
