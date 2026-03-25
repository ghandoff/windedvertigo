/**
 * IndexedDB wrapper for offline activity queue and contacts cache.
 */

const DB_NAME = "wv-crm-offline";
const DB_VERSION = 1;

export interface QueuedActivity {
  id: string;
  activity: string;
  type: string;
  contactId?: string;
  contactName?: string;
  orgName?: string;
  organizationIds?: string[];
  date: string;
  outcome?: string;
  notes?: string;
  loggedBy?: string;
  photoBlob?: Blob;
  createdAt: string;
  synced: boolean;
}

export interface CachedContact {
  id: string;
  name: string;
  role: string;
  email: string;
  organizationIds: string[];
  relationshipStage: string;
  contactWarmth: string;
  cachedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
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

// ── activity queue ───────────────────────────────────────

export async function queueActivity(activity: QueuedActivity): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("activity-queue", "readwrite");
  tx.objectStore("activity-queue").put(activity);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedActivities(): Promise<QueuedActivity[]> {
  const db = await openDB();
  const tx = db.transaction("activity-queue", "readonly");
  const store = tx.objectStore("activity-queue");
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const all = await getQueuedActivities();
  return all.filter((a) => !a.synced).length;
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("activity-queue", "readwrite");
  const store = tx.objectStore("activity-queue");
  const item = await new Promise<QueuedActivity>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (item) {
    item.synced = true;
    store.put(item);
  }
}

export async function clearSyncedActivities(): Promise<void> {
  const all = await getQueuedActivities();
  const db = await openDB();
  const tx = db.transaction("activity-queue", "readwrite");
  const store = tx.objectStore("activity-queue");
  for (const item of all) {
    if (item.synced) store.delete(item.id);
  }
}

// ── contacts cache ───────────────────────────────────────

export async function cacheContacts(contacts: CachedContact[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("contacts-cache", "readwrite");
  const store = tx.objectStore("contacts-cache");
  for (const contact of contacts) {
    store.put(contact);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedContacts(): Promise<CachedContact[]> {
  const db = await openDB();
  const tx = db.transaction("contacts-cache", "readonly");
  const store = tx.objectStore("contacts-cache");
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function searchCachedContacts(query: string): Promise<CachedContact[]> {
  const all = await getCachedContacts();
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q),
  );
}
