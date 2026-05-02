'use client';

/**
 * Wave 7.4 polish — client hook for sidebar badge counts.
 *
 * Fetches `/api/sidebar/counts` once per browser tab on mount. If multiple
 * sidebars mount at once (e.g. layout swap, RSC navigation), they share a
 * single in-flight promise via a module-scoped `inflight` so we don't
 * fan out duplicate requests.
 *
 * Returns `{ counts, loading, error, refresh }`. `counts` is null while
 * loading and after an error. `refresh()` invalidates the in-memory copy
 * and re-fetches.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

let inflight = null;            // shared Promise across hook instances
let lastPayload = null;         // last successful payload (in-tab cache)
let lastFetchedAt = 0;          // ms since epoch
const CLIENT_TTL_MS = 30_000;   // matches server cache; smooths route changes

async function fetchCounts() {
  const res = await fetch('/api/sidebar/counts', { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sidebar/counts ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

function getOrStartFetch() {
  const fresh = lastPayload && Date.now() - lastFetchedAt < CLIENT_TTL_MS;
  if (fresh) return Promise.resolve(lastPayload);
  if (inflight) return inflight;
  inflight = fetchCounts()
    .then((payload) => {
      lastPayload = payload;
      lastFetchedAt = Date.now();
      return payload;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export default function useSidebarCounts() {
  const [counts, setCounts] = useState(lastPayload);
  const [loading, setLoading] = useState(!lastPayload);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOrStartFetch()
      .then((payload) => {
        if (!mountedRef.current) return;
        setCounts(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setError(err);
        setLoading(false);
      });
  }, []);

  const refresh = useCallback(() => {
    lastPayload = null;
    lastFetchedAt = 0;
    inflight = null;
    load();
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { counts, loading, error, refresh };
}
