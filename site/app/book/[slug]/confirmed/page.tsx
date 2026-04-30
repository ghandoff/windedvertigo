/**
 * /book/[slug]/confirmed?bid=uuid
 *
 * Receipt page after a successful booking. Mints fresh cancel/reschedule
 * tokens to embed in the action buttons.
 */

import Link from "next/link";
import { selectOne } from "@/lib/booking/supabase";
import type { Booking, EventType, Host } from "@/lib/booking/supabase";
import { parseTstzrange, select } from "@/lib/booking/supabase";
import { mintCancelToken, mintRescheduleToken } from "@/lib/booking/sign";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import styles from "@/components/booking/booking.module.css";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bid?: string }>;
}

export const metadata = {
  title: "you're booked · winded.vertigo",
  description: "your playdate is confirmed.",
  robots: { index: false, follow: false },
};

export default async function ConfirmedPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const bid = sp.bid;

  let booking: Booking | null = null;
  if (bid) {
    try {
      booking = await selectOne<Booking>("bookings", { id: `eq.${bid}` });
    } catch {
      booking = null;
    }
  }

  if (!booking) {
    return (
      <>
        <SiteHeader />
        <main id="main-content" className={styles.page}>
          <div className={styles.confirmCard}>
            <h1 className={styles.confirmTitle}>booking not found</h1>
            <p className={styles.confirmDetail}>
              we couldn&apos;t find that booking — please check your email for the confirmation link.
            </p>
            <div className={styles.confirmActions}>
              <Link href={`/book/${slug}`} className={`${styles.confirmAction} ${styles.primary}`}>
                back to booking
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { start, end } = parseTstzrange(booking.during);
  const tz = booking.visitor_tz || "America/Los_Angeles";

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(start)
    .toLowerCase();
  const timeLabel = `${new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(start)
    .toLowerCase()} – ${new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  })
    .format(end)
    .toLowerCase()}`;

  // Resolve host display names
  const hostIds = [booking.assigned_host_id, ...(booking.collective_host_ids ?? [])].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  let hostNames: string[] = [];
  if (hostIds.length > 0) {
    try {
      const hosts = await select<Host>("hosts", `id=in.(${hostIds.join(",")})`);
      const byId = new Map(hosts.map((h) => [h.id, h.display_name]));
      hostNames = hostIds.map((id) => byId.get(id)).filter((n): n is string => Boolean(n));
    } catch {
      hostNames = [];
    }
  }

  // event title (best-effort)
  let eventTitle = "playdate";
  try {
    const ev = await selectOne<EventType>("event_types", { id: `eq.${booking.event_type_id}` });
    if (ev) eventTitle = ev.title.toLowerCase();
  } catch {
    // ignore
  }

  const cancelToken = await mintCancelToken(booking.id);
  const rescheduleToken = await mintRescheduleToken(booking.id);
  const rescheduleUrl = `/book/${slug}/reschedule/${encodeURIComponent(rescheduleToken)}`;
  const cancelUrl = `/api/booking/cancel?token=${encodeURIComponent(cancelToken)}&slug=${encodeURIComponent(slug)}`;

  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.page}>
        <div className={styles.confirmCard}>
          <h1 className={styles.confirmTitle}>you&apos;re booked</h1>
          <p className={styles.confirmDetail}>
            we&apos;ve sent a confirmation to{" "}
            <strong>{booking.visitor_email}</strong>.
          </p>

          <span className={styles.confirmDetailLabel}>what</span>
          <p className={styles.confirmDetail}>{eventTitle}</p>

          <span className={styles.confirmDetailLabel}>when</span>
          <p className={styles.confirmDetail}>
            {dateLabel}
            <br />
            {timeLabel}
          </p>

          {hostNames.length > 0 && (
            <>
              <span className={styles.confirmDetailLabel}>with</span>
              <p className={styles.confirmDetail}>
                {hostNames.map((n) => n.toLowerCase()).join(", ")}
              </p>
            </>
          )}

          {booking.meet_url && (
            <>
              <span className={styles.confirmDetailLabel}>meet link</span>
              <p className={styles.confirmDetail}>
                <a
                  href={booking.meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--wv-sienna, #cb7858)", textDecoration: "underline" }}
                >
                  {booking.meet_url}
                </a>
              </p>
            </>
          )}

          <div className={styles.confirmActions}>
            <a href={rescheduleUrl} className={`${styles.confirmAction} ${styles.primary}`}>
              reschedule
            </a>
            <a href={cancelUrl} className={styles.confirmAction}>
              cancel
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
