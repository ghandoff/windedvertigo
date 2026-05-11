/**
 * /bookings/[id] — booking detail view.
 *
 * Read-only display of visitor info, intake, audit trail, and a cancel button.
 * Cancellation calls the site's /api/booking/cancel endpoint via a server
 * action so we don't duplicate the GCal-delete + notification logic.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  getAuditForBooking,
  getBookingById,
  listEventTypes,
  listHosts,
} from "@/lib/booking/queries";
import { parseTstzrange } from "@/lib/booking/types";
import { CancelButton } from "../components/cancel-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();

  const [hosts, eventTypes, audit] = await Promise.all([
    listHosts({ activeOnly: false }),
    listEventTypes({ activeOnly: false }),
    getAuditForBooking(id),
  ]);

  const hostById = new Map(hosts.map((h) => [h.id, h]));
  const ev = eventTypes.find((e) => e.id === booking.event_type_id);
  const allHostIds = [
    booking.assigned_host_id,
    ...(booking.collective_host_ids ?? []),
  ].filter((hid, i, arr) => arr.indexOf(hid) === i);
  const hostNames = allHostIds
    .map((hid) => hostById.get(hid)?.display_name ?? hid.slice(0, 8))
    .join(", ");

  const range = parseTstzrange(booking.during);
  const viewerTz = "America/Los_Angeles";
  const dateStr = range.start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: viewerTz,
  });
  const timeStr = `${range.start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: viewerTz,
  })} – ${range.end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: viewerTz,
    timeZoneName: "short",
  })}`;

  const cancelable = booking.status === "confirmed";

  return (
    <div>
      <PageHeader
        title={ev?.title ?? "booking"}
        description={`${dateStr} · ${timeStr}`}
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← all bookings
        </Link>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-md border p-5">
          <h2 className="text-sm font-medium text-muted-foreground">visitor</h2>
          <Field label="name" value={booking.visitor_name} />
          <Field label="email" value={booking.visitor_email} />
          <Field label="timezone" value={booking.visitor_tz} />
          {booking.intake && Object.keys(booking.intake).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">intake answers</div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(booking.intake, null, 2)}
              </pre>
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-md border p-5">
          <h2 className="text-sm font-medium text-muted-foreground">event</h2>
          <Field label="hosts" value={hostNames} />
          <Field
            label="status"
            value={
              <Badge variant="outline">
                {booking.status}
                {booking.cancelled_at &&
                  ` · ${new Date(booking.cancelled_at).toLocaleString("en-US", {
                    timeZone: viewerTz,
                  })}`}
              </Badge>
            }
          />
          {booking.meet_url && (
            <Field
              label="meet"
              value={
                <a
                  href={booking.meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {booking.meet_url}
                </a>
              }
            />
          )}
          {booking.google_event_id && (
            <Field
              label="gcal event id"
              value={<code className="text-xs">{booking.google_event_id}</code>}
            />
          )}
          {cancelable && (
            <div className="pt-2">
              <CancelButton bookingId={booking.id} />
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-md border p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">audit log</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">no audit entries.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium">{a.action}</span>
                  {a.meta && (
                    <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {JSON.stringify(a.meta)}
                    </pre>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString("en-US", { timeZone: viewerTz })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
