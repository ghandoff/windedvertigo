/**
 * /bookings/event-types — read-only catalog of bookable event types.
 *
 * Edits are intentionally not in the UI: the source of truth is
 * `site/scripts/booking-seed-event-types.ts`. To add or remove an event type,
 * edit that script and re-run it. This avoids two ways to mutate the same
 * config (UI vs seed script) drifting apart.
 */

import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listEventTypes, listHosts } from "@/lib/booking/queries";

export const dynamic = "force-dynamic";

const MODE_COLORS: Record<string, string> = {
  solo: "bg-blue-500",
  collective: "bg-purple-500",
  round_robin: "bg-emerald-500",
};

export default async function EventTypesPage() {
  const [eventTypes, hosts] = await Promise.all([
    listEventTypes({ activeOnly: false }),
    listHosts({ activeOnly: false }),
  ]);
  const hostById = new Map(hosts.map((h) => [h.id, h]));

  return (
    <div>
      <PageHeader
        title="event types"
        description="bookable urls under windedvertigo.com/book/[slug]. read-only — edit site/scripts/booking-seed-event-types.ts to change."
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← bookings
        </Link>
      </PageHeader>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>url</TableHead>
              <TableHead>title</TableHead>
              <TableHead>mode</TableHead>
              <TableHead>duration</TableHead>
              <TableHead>host pool</TableHead>
              <TableHead>notice</TableHead>
              <TableHead>active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventTypes.map((ev) => {
              const poolNames = ev.host_pool
                .map((hid) => hostById.get(hid)?.display_name ?? hid.slice(0, 8))
                .join(", ");
              const primary = ev.primary_host_id
                ? hostById.get(ev.primary_host_id)?.display_name
                : null;
              return (
                <TableRow key={ev.id}>
                  <TableCell>
                    <a
                      href={`https://windedvertigo.com/book/${ev.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline font-mono text-xs"
                    >
                      /book/{ev.slug}
                    </a>
                  </TableCell>
                  <TableCell className="font-medium">{ev.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      <span
                        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${MODE_COLORS[ev.mode] ?? "bg-gray-400"}`}
                      />
                      {ev.mode}
                    </Badge>
                  </TableCell>
                  <TableCell>{ev.duration_min} min</TableCell>
                  <TableCell className="text-sm">
                    {poolNames}
                    {primary && primary !== poolNames && (
                      <div className="text-xs text-muted-foreground">primary: {primary}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ev.notice_min} min
                  </TableCell>
                  <TableCell>
                    {ev.active ? (
                      <Badge variant="outline" className="text-xs">live</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        off
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
