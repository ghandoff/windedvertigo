"use client";

import { useEffect, useState } from "react";
import styles from "./booking.module.css";
import { SlotPicker, detectVisitorTz, type Slot } from "./SlotPicker";
import { BookingForm, type BookingFormPrefill } from "./BookingForm";

interface BookingFlowProps {
  eventTypeId: string;
  slug: string;
  durationMin: number;
  prefill?: BookingFormPrefill;
  turnstileSiteKey?: string;
}

export function BookingFlow({
  eventTypeId,
  slug,
  durationMin,
  prefill,
  turnstileSiteKey,
}: BookingFlowProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [tz, setTz] = useState<string>("America/Los_Angeles");

  useEffect(() => {
    setTz(detectVisitorTz());
  }, []);

  return (
    <div className={styles.grid}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>pick a time</h2>
        <SlotPicker
          eventTypeId={eventTypeId}
          durationMin={durationMin}
          defaultTz={tz}
          selected={selectedSlot}
          onSelect={(s) => {
            setSelectedSlot(s);
            // gentle scroll on mobile so the form is in view
            if (typeof window !== "undefined" && window.innerWidth < 760) {
              const el = document.getElementById("booking-form-panel");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />
      </div>
      <div className={styles.panel} id="booking-form-panel">
        <h2 className={styles.panelTitle}>your details</h2>
        <BookingForm
          eventTypeId={eventTypeId}
          slug={slug}
          selectedSlot={selectedSlot}
          visitorTz={tz}
          prefill={prefill}
          turnstileSiteKey={turnstileSiteKey}
        />
      </div>
    </div>
  );
}
