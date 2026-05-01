import "next-auth";
import "next-auth/jwt";

/**
 * Harbour session fields — available on `session.userId`, `session.orgId`, etc.
 * after calling `auth()` in any harbour app.
 */
export interface HarbourSession {
  userId: string;
  orgId: string | null;
  orgName: string | null;
  orgRole: string | null;
  isAdmin: boolean;
  uiTier: string;
}

/**
 * Harbour JWT fields — stored in the session cookie and refreshed periodically.
 */
export interface HarbourToken {
  userId: string;
  email: string;
  orgId: string | null;
  orgName: string | null;
  orgRole: string | null;
  isAdmin: boolean;
  uiTier: string;
  refreshedAt: number;
}

/**
 * Options for the `enrichToken` hook — called on initial sign-in and periodic
 * refresh to populate app-specific JWT claims.
 */
export interface EnrichTokenResult {
  orgId?: string | null;
  orgName?: string | null;
  orgRole?: string | null;
  isAdmin?: boolean;
  uiTier?: string;
  [key: string]: unknown;
}

/**
 * Configuration options for `createHarbourAuth()`.
 */
export interface HarbourAuthOptions {
  /**
   * App name — used to construct basePath `/harbour/<appName>/api/auth`.
   * Pass an empty string for the harbour hub itself, which mounts at
   * `/harbour/api/auth` (no sub-path segment).
   */
  appName: string;

  /**
   * Called on initial sign-in to run app-specific setup (e.g. autoJoinOrg,
   * processInvites). Receives the user ID and email.
   */
  onFirstSignIn?: (userId: string, email: string) => Promise<void>;

  /**
   * Called on initial sign-in and periodic refresh to populate app-specific
   * JWT claims (org membership, admin status, UI tier).
   * Return the fields to merge into the token.
   */
  enrichToken?: (userId: string) => Promise<EnrichTokenResult>;

  /**
   * How often (in ms) to refresh the enrichToken data. Set to 0 or omit
   * to disable periodic refresh (only enrich on initial sign-in).
   *
   * creaseworks: 300_000 (5 min), vertigo-vault: 60_000 (1 min)
   */
  refreshInterval?: number;
}

// Augment next-auth module types so consuming apps get typed sessions
declare module "next-auth" {
  interface Session {
    userId: string;
    orgId: string | null;
    orgName: string | null;
    orgRole: string | null;
    isAdmin: boolean;
    uiTier: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    orgId: string | null;
    orgName: string | null;
    orgRole: string | null;
    isAdmin: boolean;
    uiTier: string;
    refreshedAt: number;
  }
}
