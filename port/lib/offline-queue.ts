/**
 * General-purpose offline request queue.
 *
 * Stores failed API write requests in IndexedDB and replays them
 * in order when connectivity returns. Separate from the activity-specific
 * queue in lib/pwa/offline-store.ts — this handles any API route.
 *
 * Uses its own IndexedDB database ("wv-port-request-queue") so it doesn't
 * require a version bump on the existing "wv-port-offline" database.
 */

const DB_NAME = "wv-port-request-queue";
const DB_VERSION = 1;
const STORE_NAME = "requests";

// ── types ───────────────────────────────────────────────

export interface QueueEntry {
  id: string;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
}

// ── indexeddb helpers ────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── public api ──────────────────────────────────────────

/** Generate a simple unique id. */
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Store a failed request for later replay. */
export async function enqueue(request: {
  url: string;
  method: string;
  body?: string | null;
  headers?: Record<string, string>;
}): Promise<QueueEntry> {
  const entry: QueueEntry = {
    id: uid(),
    url: request.url,
    method: request.method,
    body: request.body ?? null,
    headers: request.headers ?? {},
    timestamp: Date.now(),
    retryCount: 0,
  };

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(entry);
  await txComplete(tx);

  return entry;
}

/** Replay all queued requests in order. Removes successful ones. */
export async function flush(): Promise<{ sent: number; failed: number }> {
  const db = await openDB();

  // Read all entries ordered by timestamp
  const entries = await new Promise<QueueEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("timestamp");
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let sent = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });

      if (res.ok || res.status === 409) {
        // Success or duplicate — remove from queue
        const delTx = db.transaction(STORE_NAME, "readwrite");
        delTx.objectStore(STORE_NAME).delete(entry.id);
        await txComplete(delTx);
        sent++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        // Client error (not retryable) — discard
        const delTx = db.transaction(STORE_NAME, "readwrite");
        delTx.objectStore(STORE_NAME).delete(entry.id);
        await txComplete(delTx);
        failed++;
        console.warn("[offline-queue] discarded non-retryable:", entry.url, res.status);
      } else {
        // Server error or rate limit — keep for retry, bump count
        entry.retryCount++;
        const updateTx = db.transaction(STORE_NAME, "readwrite");
        updateTx.objectStore(STORE_NAME).put(entry);
        await txComplete(updateTx);
        failed++;
      }
    } catch {
      // Network still down — stop trying
      failed++;
      break;
    }
  }

  return { sent, failed };
}

/** Number of pending items in the queue. */
export async function count(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove all entries from the queue. */
export async function clear(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await txComplete(tx);
}
