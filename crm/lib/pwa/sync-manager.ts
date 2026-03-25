/**
 * Sync manager — pushes queued activities to the server.
 *
 * Triggered by:
 * - Background Sync API (from service worker)
 * - Manual "sync now" button
 * - Page focus (visibilitychange)
 */

import {
  getQueuedActivities,
  markAsSynced,
  clearSyncedActivities,
  type QueuedActivity,
} from "./offline-store";

const SYNC_TAG = "wv-activity-sync";

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

/** Request Background Sync registration (called from client code). */
export async function requestBackgroundSync(): Promise<void> {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(SYNC_TAG);
  }
}

/** Sync all pending activities to the server. */
export async function syncQueue(): Promise<SyncResult> {
  const items = await getQueuedActivities();
  const pending = items.filter((a) => !a.synced);
  const result: SyncResult = { synced: 0, failed: 0, pending: pending.length };

  for (const item of pending) {
    try {
      await syncSingleActivity(item);
      await markAsSynced(item.id);
      result.synced++;
    } catch (err) {
      result.failed++;
      console.error("[sync] failed:", item.id, err);
    }
  }

  result.pending = result.pending - result.synced;

  // Clean up old synced items
  await clearSyncedActivities();

  return result;
}

async function syncSingleActivity(item: QueuedActivity): Promise<void> {
  // Upload photo first if present
  let photoUrl = "";
  if (item.photoBlob) {
    const formData = new FormData();
    formData.append("file", item.photoBlob, `badge-${item.id}.jpg`);
    const uploadRes = await fetch("/crm/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      photoUrl = uploadData.url;
    }
  }

  // Build notes with photo URL if present
  const notes = photoUrl
    ? `${item.notes || ""}\n\nbadge photo: ${photoUrl}`.trim()
    : item.notes || "";

  const res = await fetch("/crm/api/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activity: item.activity,
      type: item.type,
      contactIds: item.contactId ? [item.contactId] : [],
      organizationIds: item.organizationIds ?? [],
      date: { start: item.date, end: null },
      outcome: item.outcome || undefined,
      notes: notes || undefined,
      loggedBy: item.loggedBy || undefined,
    }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`sync failed: ${res.status}`);
  }
}
