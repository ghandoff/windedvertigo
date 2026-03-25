"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/crm/sw.js", { scope: "/crm/" })
        .then((reg) => {
          console.log("[pwa] service worker registered, scope:", reg.scope);
        })
        .catch((err) => {
          console.error("[pwa] service worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
