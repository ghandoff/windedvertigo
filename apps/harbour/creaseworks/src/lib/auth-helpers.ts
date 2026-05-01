import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type UiTier = "casual" | "curious" | "collaborator";

export interface CWSession {
  userId: string;
  email: string;
  orgId: string | null;
  orgName: string | null;
  orgRole: string | null;
  isAdmin: boolean;
  /** Admin or windedvertigo.com email — can see reflective fields on all runs */
  isInternal: boolean;
  /** Progressive disclosure tier — controls nav/dashboard visibility, not access */
  uiTier: UiTier;
}

/** Returns true if the email domain is windedvertigo.com */
export function isInternalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return domain === "windedvertigo.com";
}

export async function requireAuth(): Promise<CWSession> {
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

export async function getSession(): Promise<CWSession | null> {
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

export async function requireAdmin(): Promise<CWSession> {
  const s = await requireAuth();
  if (!s.isAdmin) redirect("/");
  return s;
}

export async function requireInternal(): Promise<CWSession> {
  const s = await requireAuth();
  if (!s.isInternal) redirect("/");
  return s;
}

export async function requireOrgAdmin(): Promise<CWSession> {
  const s = await requireAuth();
  if (!s.orgId || s.orgRole !== "admin") redirect("/");
  return s;
}
