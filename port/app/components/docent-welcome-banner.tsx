"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, X } from "lucide-react";

const STORAGE_KEY = "wv-docent-banner-dismissed-v1";

/**
 * Dismissible welcome banner pointing new teammates at /docent.
 * Once dismissed, stays gone for this browser (localStorage).
 * Renders nothing on the server to avoid hydration flicker.
 */
export function DocentWelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
      // hydrating from localStorage on mount — the pattern is intentional
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(!dismissed);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  const onDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* localStorage disabled — fine */
    }
  };

  if (!visible) return null;

  return (
    <div
      className="mb-6 flex items-start gap-4 rounded-xl border-2 border-[oklch(0.61_0.12_45/0.4)] bg-[oklch(0.61_0.12_45/0.08)] p-5"
      role="region"
      aria-label="new teammate welcome"
    >
      <div className="shrink-0 rounded-full bg-[oklch(0.61_0.12_45)] p-2 text-white">
        <Compass size={20} aria-hidden="true" />
      </div>
      <div className="flex-1">
        <h2 className="mb-1 text-base font-semibold">new to the port?</h2>
        <p className="text-sm text-[oklch(0.50_0.02_250)]">
          the docent walks you through setting up your laptop for winded.vertigo work — accounts, tools, and claude code connections — in about 30 minutes. paste prompts, watch claude do the work.
        </p>
        <Link
          href="/docent"
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-[oklch(0.61_0.12_45)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[oklch(0.56_0.13_35)] focus-visible:outline-2 focus-visible:outline-[oklch(0.61_0.12_45)] focus-visible:outline-offset-2"
        >
          start the docent →
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-[oklch(0.50_0.02_250)] transition hover:bg-[oklch(0.95_0.01_80)] hover:text-[oklch(0.26_0.04_250)] focus-visible:outline-2 focus-visible:outline-[oklch(0.61_0.12_45)] focus-visible:outline-offset-2"
        aria-label="dismiss welcome banner"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
