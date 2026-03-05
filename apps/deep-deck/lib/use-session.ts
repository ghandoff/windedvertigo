"use client";

import { useState, useEffect } from "react";

interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface SessionData {
  user?: SessionUser;
  userId?: string;
  hasFullDeck?: boolean;
}

/**
 * Lightweight client-side session hook.
 * Calls the Auth.js session endpoint once on mount.
 */
export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          setSession(null);
          setLoading(false);
          return;
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
          // Auth endpoint returned non-JSON (auth not configured)
          setSession(null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          // Auth.js returns {} for unauthenticated
          setSession(data?.userId ? data : null);
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading, isAuthenticated: !!session };
}
