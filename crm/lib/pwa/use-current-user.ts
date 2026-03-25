"use client";

import { useUser } from "@/app/components/user-provider";

interface CurrentUser {
  email: string;
  name: string;
  firstName: string;
}

/**
 * Hook that returns the current authenticated user.
 * Reads from the UserProvider context (injected server-side by layouts).
 * This avoids the proxy cookie forwarding issue with /api/me.
 */
export function useCurrentUser(): CurrentUser | null {
  const user = useUser();
  return user;
}
