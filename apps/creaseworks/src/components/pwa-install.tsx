"use client";

import { useEffect, useSyncExternalStore, useState, useCallback } from "react";

/**
 * PWA service-worker registration + install-prompt banner.
 *
 * - Registers /harbour/creaseworks/sw.js on mount
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

const BASE = "/harbour/creaseworks";

/* ------------------------------------------------------------------ */
/*  Platform detection via useSyncExternalStore                        */
/*                                                                      */
/*  These browser-API values are static facts — they never change       */
/*  during a session. useSyncExternalStore lets us read them safely      */
/*  during render with an SSR-safe server snapshot.                     */
/* ------------------------------------------------------------------ */

// No-op subscribe — platform values don't change mid-session
const subscribeNoop = () => () => {};

function getIsIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
  );
}

function getIsStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

const serverFalse = () => false;

export default function PwaInstall() {
  const isIos = useSyncExternalStore(subscribeNoop, getIsIos, serverFalse);
  const isStandalone = useSyncExternalStore(
    subscribeNoop,
    getIsStandalone,
    serverFalse,
  );

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

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
  /*  Show banner logic (dismissal cooldown + iOS delay)               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    // If already installed, never show
    if (isStandalone) return;

    // Respect 14-day dismissal cooldown
    const dismissed = localStorage.getItem("cw-pwa-dismissed");
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) return;
    }

    // On iOS, show the manual instruction banner after a delay
    if (isIos) {
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isIos, isStandalone]);

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
