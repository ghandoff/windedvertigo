/**
 * Tests for credit query functions.
 *
 * Mocks sql.query() to verify:
 *  - Balance calculation (earned - spent)
 *  - Insufficient balance error on spendCredits
 *  - Award/history parameter passing
 *  - Streak bonus gating (modulo 7, daily dedup)
 *
 * P2-7: test coverage expansion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  sql: { query: (...args: any[]) => mockQuery(...args) },
}));

const {
  awardCredit,
  getUserCredits,
  getUserCreditHistory,
  spendCredits,
  checkAndAwardStreakBonus,
  CREDIT_VALUES,
  REDEMPTION_THRESHOLDS,
} = await import("./credits");

beforeEach(() => {
  mockQuery.mockReset();
});

/* ------------------------------------------------------------------ */
/*  constants                                                           */
/* ------------------------------------------------------------------ */

describe("credit constants", () => {
  it("has expected credit values", () => {
    expect(CREDIT_VALUES.quick_log).toBe(1);
    expect(CREDIT_VALUES.photo_added).toBe(2);
    expect(CREDIT_VALUES.find_again).toBe(2);
    expect(CREDIT_VALUES.marketing_consent).toBe(3);
    expect(CREDIT_VALUES.streak_bonus).toBe(5);
  });

  it("has expected redemption thresholds", () => {
    expect(REDEMPTION_THRESHOLDS.sampler_pdf).toBe(10);
    expect(REDEMPTION_THRESHOLDS.single_playdate).toBe(25);
    expect(REDEMPTION_THRESHOLDS.full_pack).toBe(50);
  });
});

/* ------------------------------------------------------------------ */
/*  awardCredit                                                         */
/* ------------------------------------------------------------------ */

describe("awardCredit", () => {
  it("inserts a credit row and returns the id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "credit-1" }] });

    const result = await awardCredit("user-1", "org-1", 2, "photo_added", "run-1");
    expect(result).toBe("credit-1");
    expect(mockQuery).toHaveBeenCalledTimes(1);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("org-1");
    expect(params[2]).toBe(2);
    expect(params[3]).toBe("photo_added");
    expect(params[4]).toBe("run-1");
  });

  it("passes null for optional runId", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "credit-2" }] });

    await awardCredit("user-1", null, 1, "quick_log");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBeNull(); // orgId
    expect(params[4]).toBeNull(); // runId
  });
});

/* ------------------------------------------------------------------ */
/*  getUserCredits                                                      */
/* ------------------------------------------------------------------ */

describe("getUserCredits", () => {
  it("returns the balance as an integer", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: "15" }] });
    const balance = await getUserCredits("user-1");
    expect(balance).toBe(15);
    expect(typeof balance).toBe("number");
  });

  it("returns 0 when no credits exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: "0" }] });
    const balance = await getUserCredits("user-no-credits");
    expect(balance).toBe(0);
  });

  it("returns 0 when row has null balance", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{}] });
    const balance = await getUserCredits("user-null");
    expect(balance).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  getUserCreditHistory                                                */
/* ------------------------------------------------------------------ */

describe("getUserCreditHistory", () => {
  it("returns credit events in order", async () => {
    const events = [
      { id: "c-1", amount: 2, reason: "photo_added", created_at: "2026-03-01" },
      { id: "c-2", amount: 1, reason: "quick_log", created_at: "2026-02-28" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: events });

    const result = await getUserCreditHistory("user-1");
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe("photo_added");
  });

  it("passes custom limit to SQL", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getUserCreditHistory("user-1", 5);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(5);
  });

  it("defaults to limit 20", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getUserCreditHistory("user-1");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(20);
  });
});

/* ------------------------------------------------------------------ */
/*  spendCredits                                                        */
/* ------------------------------------------------------------------ */

describe("spendCredits", () => {
  it("throws when balance is insufficient", async () => {
    // Atomic CTE returns no rows when balance < amount
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // getUserCredits called to build error message
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: "5" }] });

    await expect(
      spendCredits("user-1", "org-1", 25, "single_playdate"),
    ).rejects.toThrow("Insufficient credits: balance 5, needed 25");
  });

  it("inserts redemption when balance is sufficient", async () => {
    // Atomic CTE: balance check + INSERT in one query
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "redemp-1" }] });

    const result = await spendCredits("user-1", "org-1", 25, "single_playdate", "pack-1");
    expect(result).toBe("redemp-1");

    // Verify CTE params (single query now)
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("org-1");
    expect(params[2]).toBe(25);
    expect(params[3]).toBe("single_playdate");
    expect(params[4]).toBe("pack-1");
  });

  it("succeeds when balance exactly equals amount", async () => {
    // Atomic CTE succeeds when bal >= amount (includes exact match)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "redemp-exact" }] });

    const result = await spendCredits("user-1", null, 10, "sampler_pdf");
    expect(result).toBe("redemp-exact");
  });
});

/* ------------------------------------------------------------------ */
/*  checkAndAwardStreakBonus                                             */
/* ------------------------------------------------------------------ */

describe("checkAndAwardStreakBonus", () => {
  it("returns false when streak is 0", async () => {
    // streak query returns 0
    mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 0 }] });

    const result = await checkAndAwardStreakBonus("user-1", "org-1");
    expect(result).toBe(false);
    // Should only call the streak query, not the dedup or award queries
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("returns false when streak is not a multiple of 7", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 5 }] });
    const result = await checkAndAwardStreakBonus("user-1", "org-1");
    expect(result).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("returns false when streak is 7 but bonus already awarded today", async () => {
    // streak = 7
    mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 7 }] });
    // today's award check → already awarded
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "already-awarded" }] });

    const result = await checkAndAwardStreakBonus("user-1", "org-1");
    expect(result).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("awards bonus when streak is 7 and not yet awarded today", async () => {
    // streak = 7
    mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 7 }] });
    // today's award check → none
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // awardCredit INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "bonus-credit" }] });

    const result = await checkAndAwardStreakBonus("user-1", "org-1");
    expect(result).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(3);

    // Verify award params
    const [, awardParams] = mockQuery.mock.calls[2];
    expect(awardParams[0]).toBe("user-1");
    expect(awardParams[1]).toBe("org-1");
    expect(awardParams[2]).toBe(CREDIT_VALUES.streak_bonus); // 5
    expect(awardParams[3]).toBe("streak_bonus");
  });

  it("awards bonus at 14-day streak (multiple of 7)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 14 }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "bonus-14" }] });

    const result = await checkAndAwardStreakBonus("user-1", null);
    expect(result).toBe(true);
  });

  it("returns false on database error (does not throw)", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db connection failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkAndAwardStreakBonus("user-1", "org-1");
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  it("handles empty streak result gracefully", async () => {
    // streak query returns no rows
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await checkAndAwardStreakBonus("user-1", "org-1");
    expect(result).toBe(false);
  });
});
