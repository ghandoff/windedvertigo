'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const DISMISS_KEY = 'cw-first-visit-dismissed';

/**
 * First-Visit Banner
 *
 * Dismissible callout that appears on the playbook page for users with no play contexts.
 * Encourages them to take 30 seconds to tell us about their play style via the onboarding wizard.
 * Persists dismissal in localStorage so it doesn't reappear across sessions.
 */
export default function FirstVisitBanner() {
  const [isDismissed, setIsDismissed] = useState(true); // hidden by default to avoid flash

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    if (!dismissed) {
      setIsDismissed(false);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setIsDismissed(true);
  }

  if (isDismissed) {
    return null;
  }

  return (
    <div className="mb-8 rounded-xl border px-5 py-4 hover:shadow-md transition-all" style={{
      borderColor: "rgba(228, 196, 137, 0.3)",
      backgroundColor: "rgba(228, 196, 137, 0.08)",
    }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-2xs font-semibold tracking-wide text-champagne mb-1">
            new here?
          </p>
          <p className="text-base font-semibold text-cadet">
            take 30 seconds to tell us about your play style
          </p>
          <p className="text-sm text-cadet/50 mt-0.5">
            answer a few quick questions so we can recommend playdates that match your vibe.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/onboarding"
            className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--wv-sienna)" }}
          >
            get started &rarr;
          </Link>
          <button
            onClick={dismiss}
            className="text-cadet/40 hover:text-cadet/60 transition-colors text-sm font-medium"
            aria-label="Dismiss banner"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
