"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./booking.module.css";
import type { Slot } from "./SlotPicker";

export interface BookingFormPrefill {
  name?: string;
  email?: string;
  curious?: string;
  valuable?: string;
  quadrant?: string | null;
}

interface BookingFormProps {
  eventTypeId: string;
  slug: string;
  selectedSlot: Slot | null;
  visitorTz: string;
  prefill?: BookingFormPrefill;
  turnstileSiteKey?: string;
}

interface CreateResponse {
  bookingId: string;
  cancelUrl: string;
  rescheduleUrl: string;
  start: string;
  end: string;
  meetUrl?: string | null;
  hostNames?: string[];
  warnings?: string[];
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: {
        sitekey: string;
        callback: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
      }) => string;
      reset: (id?: string) => void;
    };
  }
}

export function BookingForm({
  eventTypeId,
  slug,
  selectedSlot,
  visitorTz,
  prefill,
  turnstileSiteKey,
}: BookingFormProps) {
  const [name, setName] = useState(prefill?.name ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [curious, setCurious] = useState(prefill?.curious ?? "");
  const [valuable, setValuable] = useState(prefill?.valuable ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Inject turnstile script + render widget
  useEffect(() => {
    if (!turnstileSiteKey) return;
    const SCRIPT_ID = "cf-turnstile-script";

    function renderWidget() {
      if (!turnstileRef.current || !window.turnstile) return;
      if (turnstileWidgetId.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey!,
        callback: (token: string) => setTurnstileToken(token),
        "error-callback": () => setTurnstileToken(null),
        "expired-callback": () => setTurnstileToken(null),
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderWidget);
    return () => {
      script?.removeEventListener("load", renderWidget);
    };
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!name.trim() || !email.trim()) return;
    if (turnstileSiteKey && !turnstileToken) {
      setStatus("error");
      setErrorMsg("please complete the verification");
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId,
          start: selectedSlot.start,
          visitor: {
            name: name.trim(),
            email: email.trim(),
            tz: visitorTz,
          },
          intake: {
            curious: curious.trim(),
            valuable: valuable.trim(),
            quadrant: prefill?.quadrant ?? null,
          },
          turnstileToken,
        }),
      });

      if (res.status === 201 || res.ok) {
        const data = (await res.json()) as CreateResponse;
        // Redirect to confirmation page
        window.location.href = `/book/${slug}/confirmed?bid=${encodeURIComponent(data.bookingId)}`;
        return;
      }

      let errText = "something went wrong";
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) errText = data.error;
      } catch {
        // ignore parse errors
      }

      if (res.status === 409) {
        errText = "that time was just taken — please pick another.";
      } else if (res.status === 429) {
        errText = "too many attempts — please wait a moment and try again.";
      } else if (res.status === 400) {
        errText = errText || "please check the form and try again.";
      }

      setStatus("error");
      setErrorMsg(errText);
      // reset turnstile token so user re-verifies on retry
      if (turnstileSiteKey && window.turnstile && turnstileWidgetId.current) {
        try {
          window.turnstile.reset(turnstileWidgetId.current);
        } catch {
          // ignore
        }
        setTurnstileToken(null);
      }
    } catch {
      setStatus("error");
      setErrorMsg("network error — please try again");
    }
  };

  const slotLabel = selectedSlot
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: visitorTz,
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
        .format(new Date(selectedSlot.start))
        .toLowerCase()
    : null;

  return (
    <form onSubmit={handleSubmit}>
      {slotLabel ? (
        <div className={styles.selectedSlot}>selected: {slotLabel}</div>
      ) : (
        <div className={styles.selectedSlot}>pick a time on the left to continue</div>
      )}

      <label className={styles.label} htmlFor="bk-name">
        first name
      </label>
      <input
        id="bk-name"
        type="text"
        placeholder="first name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className={styles.input}
        autoComplete="given-name"
      />

      <label className={styles.label} htmlFor="bk-email">
        email
      </label>
      <input
        id="bk-email"
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={styles.input}
        autoComplete="email"
      />

      <label className={styles.label} htmlFor="bk-curious">
        anything you&apos;re curious about?
      </label>
      <textarea
        id="bk-curious"
        placeholder="optional"
        value={curious}
        onChange={(e) => setCurious(e.target.value)}
        rows={2}
        className={styles.textarea}
      />

      <label className={styles.label} htmlFor="bk-valuable">
        anything that feels valuable to share?
      </label>
      <textarea
        id="bk-valuable"
        placeholder="optional"
        value={valuable}
        onChange={(e) => setValuable(e.target.value)}
        rows={2}
        className={styles.textarea}
      />

      {turnstileSiteKey && (
        <div ref={turnstileRef} style={{ margin: "12px 0", minHeight: 65 }} />
      )}

      <button
        type="submit"
        disabled={status === "sending" || !selectedSlot}
        className={styles.submit}
      >
        {status === "sending" ? "booking…" : "confirm playdate →"}
      </button>

      <p className={styles.formNote}>we&apos;ll send a confirmation email with calendar details.</p>

      {status === "error" && <div className={styles.errorMsg}>{errorMsg}</div>}
    </form>
  );
}
