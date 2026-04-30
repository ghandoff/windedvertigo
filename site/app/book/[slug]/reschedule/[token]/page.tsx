"use client";

/**
 * /book/[slug]/reschedule/[token] — visitor reschedule UI.
 *
 * Verifies the token via the API on mount. If valid, shows a SlotPicker
 * scoped to the same event-type and lets the visitor pick a new time.
 */

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SlotPicker, detectVisitorTz, type Slot } from "@/components/booking/SlotPicker";
import styles from "@/components/booking/booking.module.css";

interface VerifyResponse {
  ok: true;
  bookingId: string;
  eventTypeId: string;
  eventTypeSlug: string;
  durationMin: number;
  currentStart: string;
  currentEnd: string;
  visitorTz: string;
  visitorName?: string;
  hostNames?: string[];
}

interface Props {
  params: Promise<{ slug: string; token: string }>;
}

type State =
  | { kind: "loading" }
  | { kind: "expired" }
  | { kind: "too_late" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: VerifyResponse }
  | { kind: "submitting"; data: VerifyResponse }
  | { kind: "done"; newStart: string; newEnd: string; tz: string };

export default function ReschedulePage({ params }: Props) {
  const { slug, token } = use(params);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [tz, setTz] = useState<string>("America/Los_Angeles");

  useEffect(() => {
    setTz(detectVisitorTz());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/booking/reschedule/verify?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (res.status === 401) {
          setState({ kind: "expired" });
          return;
        }
        if (res.status === 403) {
          setState({ kind: "too_late" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: "something went wrong — please try again later." });
          return;
        }
        const data = (await res.json()) as VerifyResponse;
        setState({ kind: "ready", data });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "couldn't reach the server — please try again." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = useCallback(async () => {
    if (state.kind !== "ready" || !selectedSlot) return;
    setState({ kind: "submitting", data: state.data });
    try {
      const res = await fetch("/api/booking/reschedule/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newStart: selectedSlot.start }),
      });
      if (res.status === 409) {
        setState({ kind: "ready", data: state.data });
        alert("that time was just taken — please pick another.");
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: "couldn't reschedule — please try again." });
        return;
      }
      const data = (await res.json()) as { ok: true; newStart: string; newEnd: string };
      setState({ kind: "done", newStart: data.newStart, newEnd: data.newEnd, tz });
    } catch {
      setState({ kind: "error", message: "network error — please try again." });
    }
  }, [state, selectedSlot, token, tz]);

  const currentLabel = useMemo(() => {
    if (state.kind !== "ready" && state.kind !== "submitting") return null;
    const data = state.data;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: data.visitorTz || tz,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(new Date(data.currentStart))
      .toLowerCase();
  }, [state, tz]);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.hero}>
            <h1 className={styles.heroTitle}>reschedule your playdate</h1>
          </header>

          {state.kind === "loading" && <div className={styles.loading}>checking your link…</div>}

          {state.kind === "expired" && (
            <div className={styles.confirmCard}>
              <h2 className={styles.confirmTitle}>this link has expired</h2>
              <p className={styles.confirmDetail}>
                please contact us at{" "}
                <a
                  href="mailto:hello@windedvertigo.com"
                  style={{ color: "var(--wv-sienna, #cb7858)" }}
                >
                  hello@windedvertigo.com
                </a>{" "}
                and we&apos;ll find a new time together.
              </p>
            </div>
          )}

          {state.kind === "too_late" && (
            <div className={styles.confirmCard}>
              <h2 className={styles.confirmTitle}>too close to start</h2>
              <p className={styles.confirmDetail}>
                this booking is too close to the start time to reschedule online. please email us at{" "}
                <a
                  href="mailto:hello@windedvertigo.com"
                  style={{ color: "var(--wv-sienna, #cb7858)" }}
                >
                  hello@windedvertigo.com
                </a>
                .
              </p>
            </div>
          )}

          {state.kind === "error" && (
            <div className={styles.confirmCard}>
              <h2 className={styles.confirmTitle}>something went wrong</h2>
              <p className={styles.confirmDetail}>{state.message}</p>
            </div>
          )}

          {(state.kind === "ready" || state.kind === "submitting") && (
            <>
              <p className={styles.heroDescription} style={{ marginBottom: 24 }}>
                currently booked for <strong>{currentLabel}</strong>. pick a new time below.
              </p>
              <div className={styles.panel}>
                <SlotPicker
                  eventTypeId={state.data.eventTypeId}
                  durationMin={state.data.durationMin}
                  defaultTz={tz}
                  selected={selectedSlot}
                  onSelect={(s) => setSelectedSlot(s)}
                />
                <button
                  type="button"
                  className={styles.submit}
                  disabled={!selectedSlot || state.kind === "submitting"}
                  onClick={submit}
                  style={{ marginTop: 16 }}
                >
                  {state.kind === "submitting" ? "rescheduling…" : "confirm new time →"}
                </button>
              </div>
            </>
          )}

          {state.kind === "done" && (
            <div className={styles.confirmCard}>
              <h2 className={styles.confirmTitle}>rescheduled</h2>
              <p className={styles.confirmDetail}>
                new time:{" "}
                <strong>
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: state.tz,
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })
                    .format(new Date(state.newStart))
                    .toLowerCase()}
                </strong>
              </p>
              <p className={styles.confirmDetail}>
                we&apos;ve sent an updated calendar invite to your email.
              </p>
              <div className={styles.confirmActions}>
                <Link href="/" className={styles.confirmAction}>
                  back to winded.vertigo
                </Link>
                <Link href={`/book/${slug}`} className={`${styles.confirmAction} ${styles.primary}`}>
                  book another
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
