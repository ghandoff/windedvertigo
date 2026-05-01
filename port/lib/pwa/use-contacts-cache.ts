"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCachedContacts,
  cacheContacts,
  searchCachedContacts,
  type CachedContact,
} from "./offline-store";
import { useOnlineStatus } from "./use-online-status";

/**
 * Hook that manages the contacts cache.
 * Online: fetches from API + updates cache.
 * Offline: reads from IndexedDB cache.
 */
export function useContactsCache() {
  const isOnline = useOnlineStatus();
  const [contacts, setContacts] = useState<CachedContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Refresh cache from API
  const refresh = useCallback(async () => {
    if (!isOnline) {
      const cached = await getCachedContacts();
      setContacts(cached);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/contacts?pageSize=200");
      if (res.ok) {
        const data = await res.json();
        const mapped: CachedContact[] = (data.data ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => ({
            id: c.id,
            name: c.name,
            role: c.role ?? "",
            email: c.email ?? "",
            organizationIds: c.organizationIds ?? [],
            relationshipStage: c.relationshipStage ?? "",
            contactWarmth: c.contactWarmth ?? "",
            cachedAt: new Date().toISOString(),
          }),
        );
        await cacheContacts(mapped);
        setContacts(mapped);
      }
    } catch {
      // Fall back to cache
      const cached = await getCachedContacts();
      setContacts(cached);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const search = useCallback(
    async (query: string): Promise<CachedContact[]> => {
      if (!query) return contacts.slice(0, 20);

      if (isOnline) {
        try {
          const res = await fetch(
            `/api/contacts?search=${encodeURIComponent(query)}&pageSize=20`,
          );
          if (res.ok) {
            const data = await res.json();
            return (data.data ?? []).map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (c: any) => ({
                id: c.id,
                name: c.name,
                role: c.role ?? "",
                email: c.email ?? "",
                organizationIds: c.organizationIds ?? [],
                relationshipStage: c.relationshipStage ?? "",
                contactWarmth: c.contactWarmth ?? "",
                cachedAt: new Date().toISOString(),
              }),
            );
          }
        } catch {
          // fall through to cached search
        }
      }

      return searchCachedContacts(query);
    },
    [contacts, isOnline],
  );

  return { contacts, loading, search, refresh };
}
