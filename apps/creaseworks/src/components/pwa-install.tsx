"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * PWA service-worker registration + install-prompt banner.
 *
 * - Registers /reservoir/creaseworks/sw.js on mount
 * - Captures the `beforeinstallprompt` event (Chrome/Edge/Android)
 * - Shows a dismissible banner offering to "add to home screen"
 * - On iOS Safari, shows manual instructions instead (no prompt API)
 *
 * Render this once, inside a client-side Providers wrapper.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const BASE = "/reservoir/creaseworks";

export default function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Register service worker                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
        .catch((err) => console.warn("[SW] registration failed:", err));
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Detect platform + standalone mode                                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as any).standalone === true);

    setIsIos(ios);
    setIsStandalone(standalone);

    // If already installed or dismissed recently, don't show
    if (standalone) return;
    const dismissed = localStorage.getItem("cw-pwa-dismissed");
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      // Don't re-show for 14 days after dismissal
      if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) return;
    }

    // On iOS, show the manual instruction banner after a delay
    if (ios) {
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Capture beforeinstallprompt (Chrome / Edge / Android)            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (isStandalone) return;

    function handlePrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, [isStandalone]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem("cw-pwa-dismissed", String(Date.now()));
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (!showBanner || isStandalone) return null;

  return (
    <div
      role="banner"
      aria-label="Install app"
      className="pwa-install-banner"
    >
      <div className="pwa-install-content">
        <p className="pwa-install-text">
          {isIos ? (
            <>
              install creaseworks: tap{" "}
              <span aria-label="share" role="img">
                ↗
              </span>{" "}
              then &ldquo;Add to Home Screen&rdquo;
            </>
          ) : (
            <>add creaseworks to your home screen for quick access</>
          )}
        </p>
        <div className="pwa-install-actions">
          {!isIos && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="pwa-install-btn"
            >
              install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="pwa-install-dismiss"
            aria-label="Dismiss install banner"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
