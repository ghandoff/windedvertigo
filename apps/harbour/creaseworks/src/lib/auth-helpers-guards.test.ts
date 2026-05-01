/**
 * Tests for auth guard functions: requireAuth, getSession, requireAdmin,
 * requireInternal, requireOrgAdmin.
 *
 * Complements the existing auth-helpers.test.ts (which covers isInternalEmail).
 * These tests verify the session-building and redirect logic.
 *
 * P2-7: test coverage expansion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Track redirect calls
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    // redirect() in Next.js throws to halt execution; simulate that
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Mock auth() — returns various session shapes
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const {
  requireAuth,
  getSession,
  requireAdmin,
  requireInternal,
  requireOrgAdmin,
} = await import("./auth-helpers");

beforeEach(() => {
  mockAuth.mockReset();
  mockRedirect.mockClear();
});

/* ------------------------------------------------------------------ */
/*  helper: build mock session                                          */
/* ------------------------------------------------------------------ */

function makeSession(overrides: Record<string, any> = {}) {
  return {
    user: { email: "garrett@windedvertigo.com" },
    userId: "user-1",
    orgId: "org-1",
    orgName: "Creaseworks",
    orgRole: "admin",
    isAdmin: true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  requireAuth                                                         */
/* ------------------------------------------------------------------ */

describe("requireAuth", () => {
  it("returns CWSession when user is authenticated", async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    const s = await requireAuth();
    expect(s.userId).toBe("user-1");
    expect(s.email).toBe("garrett@windedvertigo.com");
    expect(s.orgId).toBe("org-1");
    expect(s.isAdmin).toBe(true);
    expect(s.isInternal).toBe(true);
  });

  it("redirects to /login when no session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when session has no email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: null }, userId: "u-1" });
    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("sets isInternal=true for windedvertigo.com emails even without admin", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({
        isAdmin: false,
        user: { email: "team@windedvertigo.com" },
      }),
    );
    const s = await requireAuth();
    expect(s.isAdmin).toBe(false);
    expect(s.isInternal).toBe(true);
  });

  it("sets isInternal=false for non-admin, non-wv emails", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({
        isAdmin: false,
        user: { email: "teacher@school.edu" },
      }),
    );
    const s = await requireAuth();
    expect(s.isAdmin).toBe(false);
    expect(s.isInternal).toBe(false);
  });

  it("sets isInternal=true for admins regardless of email", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({
        isAdmin: true,
        user: { email: "superuser@gmail.com" },
      }),
    );
    const s = await requireAuth();
    expect(s.isAdmin).toBe(true);
    expect(s.isInternal).toBe(true);
  });

  it("handles missing orgId gracefully (null)", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({ orgId: undefined, orgName: undefined, orgRole: undefined }),
    );
    const s = await requireAuth();
    expect(s.orgId).toBeNull();
    expect(s.orgName).toBeNull();
    expect(s.orgRole).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  getSession                                                          */
/* ------------------------------------------------------------------ */

describe("getSession", () => {
  it("returns CWSession when user is authenticated", async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    const s = await getSession();
    expect(s).not.toBeNull();
    expect(s!.userId).toBe("user-1");
    expect(s!.isAdmin).toBe(true);
  });

  it("returns null when no session (does NOT redirect)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const s = await getSession();
    expect(s).toBeNull();
    // Should NOT redirect
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns null when session has no email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: null } });
    const s = await getSession();
    expect(s).toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  requireAdmin                                                        */
/* ------------------------------------------------------------------ */

describe("requireAdmin", () => {
  it("returns session when user is admin", async () => {
    mockAuth.mockResolvedValueOnce(makeSession({ isAdmin: true }));
    const s = await requireAdmin();
    expect(s.isAdmin).toBe(true);
  });

  it("redirects to / when user is not admin", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({ isAdmin: false, user: { email: "user@school.edu" } }),
    );
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("redirects to /login when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

/* ------------------------------------------------------------------ */
/*  requireInternal                                                     */
/* ------------------------------------------------------------------ */

describe("requireInternal", () => {
  it("returns session for windedvertigo.com emails", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({
        isAdmin: false,
        user: { email: "team@windedvertigo.com" },
      }),
    );
    const s = await requireInternal();
    expect(s.isInternal).toBe(true);
  });

  it("returns session for admins (even non-wv email)", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({
        isAdmin: true,
        user: { email: "admin@external.com" },
      }),
    );
    const s = await requireInternal();
    expect(s.isInternal).toBe(true);
  });

  it("redirects to / for non-internal users", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({
        isAdmin: false,
        user: { email: "parent@gmail.com" },
      }),
    );
    await expect(requireInternal()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

/* ------------------------------------------------------------------ */
/*  requireOrgAdmin                                                     */
/* ------------------------------------------------------------------ */

describe("requireOrgAdmin", () => {
  it("returns session for org admins", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({ orgId: "org-1", orgRole: "admin" }),
    );
    const s = await requireOrgAdmin();
    expect(s.orgId).toBe("org-1");
    expect(s.orgRole).toBe("admin");
  });

  it("redirects to / when user has no org", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({ orgId: undefined, orgRole: undefined }),
    );
    await expect(requireOrgAdmin()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("redirects to / when user is org member (not admin)", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({ orgId: "org-1", orgRole: "member" }),
    );
    await expect(requireOrgAdmin()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("redirects to / when orgRole is null", async () => {
    mockAuth.mockResolvedValueOnce(
      makeSession({ orgId: "org-1", orgRole: null }),
    );
    await expect(requireOrgAdmin()).rejects.toThrow("NEXT_REDIRECT:/");
  });
});
