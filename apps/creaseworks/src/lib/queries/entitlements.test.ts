/**
 * Tests for entitlement query functions.
 *
 * Mocks sql.query() to verify:
 *  - Dual-scope logic (org + user level entitlements)
 *  - Early return when no org/user
 *  - Grant/revoke flow correctness
 *  - Parameter passing to SQL queries
 *
 * P2-7: test coverage expansion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module — intercept all sql.query() calls
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  sql: { query: (...args: any[]) => mockQuery(...args) },
}));

const {
  checkEntitlement,
  grantEntitlement,
  grantUserEntitlement,
  revokeEntitlement,
  listOrgEntitlements,
  getOrgPacksWithProgress,
} = await import("./entitlements");

beforeEach(() => {
  mockQuery.mockReset();
});

/* ------------------------------------------------------------------ */
/*  checkEntitlement                                                    */
/* ------------------------------------------------------------------ */

describe("checkEntitlement", () => {
  it("returns false immediately when both orgId and userId are null", async () => {
    const result = await checkEntitlement(null, "pack-1");
    expect(result).toBe(false);
    // Should NOT hit the database at all
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns false when both orgId and userId are explicitly null", async () => {
    const result = await checkEntitlement(null, "pack-1", null);
    expect(result).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns true when org-level entitlement exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const result = await checkEntitlement("org-1", "pack-1");
    expect(result).toBe(true);
    // Verify correct params passed
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("pack-1"); // pack_cache_id
    expect(params[1]).toBe("org-1"); // org_id
    expect(params[2]).toBeNull(); // user_id (not provided)
  });

  it("returns true when user-level entitlement exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const result = await checkEntitlement(null, "pack-1", "user-1");
    expect(result).toBe(true);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("pack-1");
    expect(params[1]).toBeNull(); // orgId is null
    expect(params[2]).toBe("user-1");
  });

  it("checks both scopes when both orgId and userId provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const result = await checkEntitlement("org-1", "pack-1", "user-1");
    expect(result).toBe(true);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("pack-1");
    expect(params[1]).toBe("org-1");
    expect(params[2]).toBe("user-1");
  });

  it("returns false when no entitlement found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await checkEntitlement("org-1", "pack-1", "user-1");
    expect(result).toBe(false);
  });

  it("handles undefined userId by passing null", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await checkEntitlement("org-1", "pack-1", undefined);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[2]).toBeNull(); // undefined → null via ?? null
  });
});

/* ------------------------------------------------------------------ */
/*  grantEntitlement (org-level)                                       */
/* ------------------------------------------------------------------ */

describe("grantEntitlement", () => {
  it("ensures packs_catalogue row, then tries update before insert", async () => {
    // 1. packs_catalogue upsert
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 2. UPDATE existing → no rows (new entitlement)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 3. INSERT → returns new id
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-1" }] });

    const result = await grantEntitlement("org-1", "pack-1", "purch-1");
    expect(result).toEqual({ id: "ent-1" });
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("revives a revoked entitlement via UPDATE path", async () => {
    // 1. packs_catalogue upsert
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // 2. UPDATE finds existing row → returns id
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-existing" }] });

    const result = await grantEntitlement("org-1", "pack-1");
    expect(result).toEqual({ id: "ent-existing" });
    // Should NOT call INSERT (3rd query)
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("passes null for optional purchaseId and expiresAt", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // catalogue
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update miss
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-new" }] }); // insert

    await grantEntitlement("org-1", "pack-1");
    // Check INSERT params
    const [, insertParams] = mockQuery.mock.calls[2];
    expect(insertParams[2]).toBeNull(); // purchaseId
    expect(insertParams[3]).toBeNull(); // expiresAt
  });

  it("passes expiresAt through to SQL", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // catalogue
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update miss
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-trial" }] }); // insert

    await grantEntitlement("org-1", "pack-1", null, "2026-04-01");
    const [, insertParams] = mockQuery.mock.calls[2];
    expect(insertParams[3]).toBe("2026-04-01");
  });
});

/* ------------------------------------------------------------------ */
/*  grantUserEntitlement                                                */
/* ------------------------------------------------------------------ */

describe("grantUserEntitlement", () => {
  it("ensures catalogue then tries update before insert", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // catalogue
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update miss
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-user-1" }] }); // insert

    const result = await grantUserEntitlement("user-1", "pack-1");
    expect(result).toEqual({ id: "ent-user-1" });
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("revives existing user entitlement via UPDATE", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // catalogue
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-revived" }] }); // update hit

    const result = await grantUserEntitlement("user-1", "pack-1");
    expect(result).toEqual({ id: "ent-revived" });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("passes expiresAt to both update and insert", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // catalogue
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update miss
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ent-timed" }] }); // insert

    await grantUserEntitlement("user-1", "pack-1", "2026-06-01");
    // Update query params
    const [, updateParams] = mockQuery.mock.calls[1];
    expect(updateParams[2]).toBe("2026-06-01");
    // Insert query params
    const [, insertParams] = mockQuery.mock.calls[2];
    expect(insertParams[2]).toBe("2026-06-01");
  });
});

/* ------------------------------------------------------------------ */
/*  revokeEntitlement                                                   */
/* ------------------------------------------------------------------ */

describe("revokeEntitlement", () => {
  it("sets revoked_at on matching org+pack entitlement", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await revokeEntitlement("org-1", "pack-1");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("org-1");
    expect(params[1]).toBe("pack-1");
  });
});

/* ------------------------------------------------------------------ */
/*  listOrgEntitlements                                                 */
/* ------------------------------------------------------------------ */

describe("listOrgEntitlements", () => {
  it("returns entitled packs for an org", async () => {
    const mockRows = [
      {
        id: "ent-1",
        pack_cache_id: "pack-1",
        pack_title: "Rainy Day Rescue",
        pack_slug: "rainy-day-rescue",
        granted_at: "2026-01-15",
        expires_at: null,
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const result = await listOrgEntitlements("org-1");
    expect(result).toEqual(mockRows);
    expect(result).toHaveLength(1);
    expect(result[0].pack_title).toBe("Rainy Day Rescue");
  });

  it("returns empty array when org has no entitlements", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await listOrgEntitlements("org-no-packs");
    expect(result).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  getOrgPacksWithProgress                                             */
/* ------------------------------------------------------------------ */

describe("getOrgPacksWithProgress", () => {
  it("passes null orgId correctly for org-less users", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getOrgPacksWithProgress(null, "user-1");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBeNull(); // orgId → null
    expect(params[1]).toBe("user-1");
  });

  it("returns pack progress data", async () => {
    const mockPacks = [
      {
        id: "pack-1",
        slug: "rainy-day-rescue",
        title: "Rainy Day Rescue",
        description: "Indoor play activities",
        playdate_count: 5,
        tried_count: 3,
        found_count: 2,
        folded_count: 1,
        found_again_count: 0,
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockPacks });

    const result = await getOrgPacksWithProgress("org-1", "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].tried_count).toBe(3);
    expect(result[0].playdate_count).toBe(5);
  });
});
