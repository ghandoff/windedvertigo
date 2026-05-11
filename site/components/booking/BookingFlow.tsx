"use client";

import { useEffect, useState } from "react";
import styles from "./booking.module.css";
import { SlotGrid, detectVisitorTz, type Slot } from "./SlotGrid";
import { BookingForm, type BookingFormPrefill } from "./BookingForm";

interface BookingFlowProps {
  eventTypeId: string;
  slug: string;
  durationMin: number;
  durationOptions: number[];
  prefill?: BookingFormPrefill;
  turnstileSiteKey?: string;
}

export function BookingFlow({
  eventTypeId,
  slug,
  durationMin,
  durationOptions,
  prefill,
  turnstileSiteKey,
}: BookingFlowProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [tz, setTz] = useState<string>("America/Los_Angeles");

  useEffect(() => {
    setTz(detectVisitorTz());
  }, []);

  const scrollToPicker = () => {
    if (typeof window !== "undefined" && window.innerWidth < 760) {
      const el = document.getElementById("booking-picker-panel");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className={styles.grid}>
      <div className={styles.panel} id="booking-picker-panel">
        <h2 className={styles.panelTitle}>pick a time</h2>
        <SlotGrid
          eventTypeId={eventTypeId}
          durationMin={durationMin}
          durationOptions={durationOptions}
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
          onClear={() => setSelectedSlot(null)}
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
          onChangeTime={() => {
            setSelectedSlot(null);
            scrollToPicker();
          }}
        />
      </div>
    </div>
  );
}
