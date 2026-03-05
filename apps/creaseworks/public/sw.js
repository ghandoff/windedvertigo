/**
 * creaseworks service worker
 *
 * Strategy:
 *  - Static assets (JS, CSS, fonts, images): cache-first
 *  - Navigation requests (HTML): network-first with offline fallback
 *  - API calls: network-only (no caching)
 *
 * The SW is scoped to /harbor/creaseworks/ via the manifest.
 */

const CACHE_NAME = "cw-v1";
const BASE = "/harbor/creaseworks";

// App shell assets to pre-cache on install
const PRECACHE_URLS = [
  `${BASE}/`,
  `${BASE}/manifest.json`,
  `${BASE}/images/icon-192x192.png`,
  `${BASE}/images/icon-512x512.png`,
];

/* ------------------------------------------------------------------ */
/*  Install — pre-cache app shell                                      */
/* ------------------------------------------------------------------ */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

/* ------------------------------------------------------------------ */
/*  Activate — clean old caches                                        */
/* ------------------------------------------------------------------ */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key.startsWith("cw-"))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* ------------------------------------------------------------------ */
/*  Fetch — routing strategy                                           */
/* ------------------------------------------------------------------ */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API routes and auth endpoints — always network
  if (url.pathname.startsWith(`${BASE}/api/`)) return;
  if (url.pathname.includes("/auth/")) return;

  // Skip cross-origin requests (Stripe, Vercel, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation requests — network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Offline — try cache, then fall back to cached home page
          caches
            .match(request)
            .then((cached) => cached || caches.match(`${BASE}/`)),
        ),
    );
    return;
  }

  // Static assets — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|avif)(\?.*)?$/.test(
    pathname,
  );
}
