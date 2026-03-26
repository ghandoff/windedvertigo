/**
 * w.v CRM service worker
 *
 * Strategies:
 * - App shell (mobile routes): cache-first with network update
 * - API reads: network-first with cache fallback
 * - API writes: background sync queue
 * - Static assets: stale-while-revalidate
 */

const CACHE_NAME = "wv-crm-v1";
const OFFLINE_PAGE = "/m/log";
const SYNC_TAG = "wv-activity-sync";

// App shell pages to precache
const SHELL_URLS = [
  "/m",
  "/m/log",
  "/m/contacts",
  "/m/today",
];

// ── install: precache app shell ──────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't fail install if precaching fails (pages might require auth)
      return Promise.allSettled(
        SHELL_URLS.map((url) =>
          cache.add(url).catch(() => console.log("[sw] skip precache:", url))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── activate: clean old caches ───────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── fetch: route-based strategies ────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (let POST/PATCH/DELETE go through normally)
  if (event.request.method !== "GET") return;

  // Skip auth routes
  if (url.pathname.includes("/api/auth")) return;

  // API reads: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets: stale-while-revalidate
  if (
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/) ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Mobile routes: network-first (prefer fresh, fall back to cache)
  if (url.pathname.startsWith("/m")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(event.request));
});

// ── background sync: activity queue ──────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncActivities());
  }
});

async function syncActivities() {
  // Read queued activities from IndexedDB and POST each one
  // This is triggered by the Background Sync API when connection returns
  try {
    const db = await openDB();
    const tx = db.transaction("activity-queue", "readonly");
    const store = tx.objectStore("activity-queue");
    const items = await getAllFromStore(store);

    for (const item of items) {
      if (item.synced) continue;

      try {
        // Upload photo first if present
        let photoUrl = "";
        if (item.photoBlob) {
          const formData = new FormData();
          formData.append("file", item.photoBlob, `badge-${item.id}.jpg`);
          const uploadRes = await fetch("/api/assets/upload", {
            method: "POST",
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            photoUrl = uploadData.url;
          }
        }

        // Create activity
        const notes = photoUrl
          ? `${item.notes || ""}\n\nbadge photo: ${photoUrl}`.trim()
          : item.notes || "";

        const res = await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activity: item.activity,
            type: item.type,
            contactIds: item.contactId ? [item.contactId] : [],
            date: { start: item.date, end: null },
            outcome: item.outcome || undefined,
            notes: notes || undefined,
            loggedBy: item.loggedBy || undefined,
          }),
        });

        if (res.ok || res.status === 409) {
          // Mark as synced
          const writeTx = db.transaction("activity-queue", "readwrite");
          const writeStore = writeTx.objectStore("activity-queue");
          item.synced = true;
          writeStore.put(item);
        }
      } catch (err) {
        console.error("[sw] sync failed for item:", item.id, err);
      }
    }
  } catch (err) {
    console.error("[sw] syncActivities failed:", err);
  }
}

// ── caching strategies ───────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || (await fetchPromise) || new Response("offline", { status: 503 });
}

// ── IndexedDB helpers (for sync) ─────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("wv-crm-offline", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("activity-queue")) {
        db.createObjectStore("activity-queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("contacts-cache")) {
        db.createObjectStore("contacts-cache", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
