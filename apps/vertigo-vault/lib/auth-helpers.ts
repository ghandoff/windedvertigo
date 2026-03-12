import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UiTier } from "@/lib/queries/accessibility";

export type { UiTier };

export interface VaultSession {
  userId: string;
  email: string;
  orgId: string | null;
  orgName: string | null;
  orgRole: string | null;
  isAdmin: boolean;
  /** Admin or windedvertigo.com email — gets internal-tier vault access */
  isInternal: boolean;
  /** Progressive disclosure tier — controls nav visibility, not access */
  uiTier: UiTier;
}

/** Returns true if the email domain is windedvertigo.com */
export function isInternalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return domain === "windedvertigo.com";
}

export async function requireAuth(): Promise<VaultSession> {
  const s = await auth();
  if (!s?.user?.email) redirect("/login");
  const admin = s.isAdmin ?? false;
  return {
    userId: s.userId,
    email: s.user.email,
    orgId: s.orgId ?? null,
    orgName: s.orgName ?? null,
    orgRole: s.orgRole ?? null,
    isAdmin: admin,
    isInternal: admin || isInternalEmail(s.user.email),
    uiTier: (s.uiTier as UiTier) ?? "casual",
  };
}

export async function getSession(): Promise<VaultSession | null> {
  const s = await auth();
  if (!s?.user?.email) return null;
  const admin = s.isAdmin ?? false;
  return {
    userId: s.userId,
    email: s.user.email,
    orgId: s.orgId ?? null,
    orgName: s.orgName ?? null,
    orgRole: s.orgRole ?? null,
    isAdmin: admin,
    isInternal: admin || isInternalEmail(s.user.email),
    uiTier: (s.uiTier as UiTier) ?? "casual",
  };
}
