"use client";

import { useState, useEffect } from "react";

interface CurrentUser {
  email: string;
  name: string;
  firstName: string;
  image: string;
}

/**
 * Hook that fetches the current authenticated user.
 * Returns their first name (lowercase) for auto-filling "logged by".
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch("/crm/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.firstName) setUser(data);
      })
      .catch(() => {});
  }, []);

  return user;
}
