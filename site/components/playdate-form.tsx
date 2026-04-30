"use client";

import { useState, useCallback, useEffect } from "react";
import styles from "./package-builder-wizard.module.css";

interface PlaydateFormProps {
  quadrant: string | null;
  quadrantHistory: string[];
  className?: string;
  buttonLabel?: string;
}

export function PlaydateForm({ quadrant, quadrantHistory, className, buttonLabel = "book a playdate" }: PlaydateFormProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [curious, setCurious] = useState("");
  const [valuable, setValuable] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [hostHint, setHostHint] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Escape key + body scroll lock
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [showModal, closeModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/book-playdate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          curious: curious.trim(),
          valuable: valuable.trim(),
          quadrant,
          quadrantHistory,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        bookingUrl?: string;
        slug?: string;
        hostHint?: string;
      };

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "something went wrong");
        return;
      }

      // The API returns a routed /book/[slug]?prefill=... URL. Stash it
      // for the success-state CTA so the visitor lands on a pre-filled
      // booking form instead of the old static Google Calendar link.
      setBookingUrl(data.bookingUrl ?? null);
      setHostHint(data.hostHint ?? null);
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("network error — please try again");
    }
  };

  return (
    <>
      <button
        className={className ?? `${styles.ctaBtn} ${styles.primary}`}
        onClick={() => setShowModal(true)}
      >
        {buttonLabel}
      </button>

      {showModal && (
        <div
          className={styles.emailOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          role="dialog"
          aria-modal="true"
          aria-label="book a playdate"
        >
          <div className={styles.emailModal}>
            <button className={styles.emailClose} onClick={closeModal} aria-label="close">
              ×
            </button>

            {status === "sent" ? (
              <div className={styles.playdateSuccess}>
                <h3>you&apos;re almost there</h3>
                <p>
                  {hostHint
                    ? `based on what you shared, we've matched you with ${hostHint}. pick a time that works for you.`
                    : "we've got your details — now pick a time that works for you."}
                </p>
                {bookingUrl ? (
                  <a
                    href={bookingUrl}
                    className={`${styles.ctaBtn} ${styles.primary}`}
                    style={{ display: "inline-block", width: "100%" }}
                  >
                    choose a time →
                  </a>
                ) : (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
                    check your email for the booking link.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textTransform: "lowercase" }}>
                  book a playdate
                </h3>
                <p className={styles.playdateSubtitle}>
                  a little context goes a long way — share what caught your eye so we can jump straight into exploring how we might work and play together.
                </p>

                <input
                  type="text"
                  placeholder="first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className={styles.emailInput}
                />
                <input
                  type="email"
                  placeholder="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={styles.emailInput}
                />

                <textarea
                  placeholder="which parts of our website made you feel the most curious today?"
                  value={curious}
                  onChange={(e) => setCurious(e.target.value)}
                  rows={2}
                  className={styles.playdateTextarea}
                />
                <textarea
                  placeholder="which of our services or case studies feel the most valuable for you?"
                  value={valuable}
                  onChange={(e) => setValuable(e.target.value)}
                  rows={2}
                  className={styles.playdateTextarea}
                />

                <p className={styles.playdateHint}>
                  these are totally optional — just helps us make our time together better
                </p>

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className={`${styles.ctaBtn} ${styles.primary}`}
                  style={{ width: "100%", marginTop: 4 }}
                >
                  {status === "sending" ? "sending…" : "let's play →"}
                </button>

                {status === "error" && (
                  <p style={{ fontSize: 12, color: "var(--wv-redwood, #b15043)", margin: "10px 0 0", textAlign: "center" }}>
                    {errorMsg}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
