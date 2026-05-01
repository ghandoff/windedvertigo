/**
 * Tests for the Stripe webhook event-id idempotency cache.
 *
 * Mocks sql.query() to verify:
 *  - seenEvent returns false on first call, true on second (full lifecycle)
 *  - markEventSeen issues an INSERT…ON CONFLICT DO NOTHING (no TTL overwrite
 *    for already-seen events; the schema default sets the 7-day expires_at)
 *  - seenEvent returns false on a DB error (graceful degradation)
 *
 * Track C of the macro stack-migration plan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  sql: { query: (...args: any[]) => mockQuery(...args) },
}));

const { seenEvent, markEventSeen } = await import("./webhook-event-cache");

beforeEach(() => {
  mockQuery.mockReset();
});

describe("seenEvent + markEventSeen — happy path", () => {
  it("returns false on first call, true on second", async () => {
    // First call: row not present yet
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const before = await seenEvent("evt_abc");
    expect(before).toBe(false);

    // Mark it seen (INSERT)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await markEventSeen("evt_abc");

    // Second call: row present
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const after = await seenEvent("evt_abc");
    expect(after).toBe(true);

    // Sanity: the SELECT filters on expires_at > NOW() so expired rows
    // don't count as seen.
    const selectCall = mockQuery.mock.calls[0][0] as string;
    expect(selectCall).toMatch(/expires_at\s*>\s*NOW\(\)/i);
  });
});

describe("markEventSeen — TTL semantics", () => {
  it("uses ON CONFLICT DO NOTHING so the existing 7-day TTL is preserved", async () => {
    // The schema default (expires_at = NOW() + INTERVAL '7 days') is what
    // sets the TTL. markEventSeen must NOT overwrite it on a re-mark — the
    // ON CONFLICT DO NOTHING clause is the test surface here.
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await markEventSeen("evt_xyz");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sqlText = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];

    expect(sqlText).toMatch(/INSERT\s+INTO\s+stripe_webhook_events/i);
    expect(sqlText).toMatch(/ON\s+CONFLICT\s*\(\s*event_id\s*\)\s+DO\s+NOTHING/i);
    expect(params).toEqual(["evt_xyz"]);
  });
});

describe("seenEvent — graceful degradation", () => {
  it("returns false when the DB throws (does not propagate)", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));
    const result = await seenEvent("evt_oops");
    expect(result).toBe(false);
  });
});
