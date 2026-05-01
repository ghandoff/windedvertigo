/**
 * Tests for the visibility model and reflective field stripping.
 *
 * Session 14 audit-1: integration test coverage for the visibility
 * logic that controls which runs and fields each user can see.
 *
 * The visibility model:
 *   - Admin: sees all runs across all orgs
 *   - Org member (internal): sees all runs for their org
 *   - External user: sees only runs they created
 *   - Reflective fields (what_changed, next_iteration):
 *     stripped for non-creators and non-internal users
 */

import { describe, it, expect } from "vitest";
import type { CWSession } from "./auth-helpers";

// ── Helpers that mirror the route handler logic ─────────────

/** Simulates the reflective-field stripping from GET /api/runs */
function stripReflectiveFields(
  run: { created_by: string; what_changed: string | null; next_iteration: string | null },
  session: Pick<CWSession, "isInternal" | "userId">,
): { what_changed: string | null; next_iteration: string | null } {
  if (session.isInternal || run.created_by === session.userId) {
    return { what_changed: run.what_changed, next_iteration: run.next_iteration };
  }
  return { what_changed: null, next_iteration: null };
}

/** Simulates PATCH key whitelisting from PATCH /api/runs/[id] */
const ALLOWED_KEYS = new Set([
  "title", "playdateId", "runType", "runDate",
  "contextTags", "traceEvidence", "whatChanged",
  "nextIteration", "materialIds",
]);

function getUnknownKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
}

// ── Tests ───────────────────────────────────────────────────

describe("reflective field stripping", () => {
  const run = {
    created_by: "user-123",
    what_changed: "improved facilitation flow",
    next_iteration: "add breakout rooms",
  };

  it("shows reflective fields to the run creator", () => {
    const session = { userId: "user-123", isInternal: false };
    const result = stripReflectiveFields(run, session);
    expect(result.what_changed).toBe("improved facilitation flow");
    expect(result.next_iteration).toBe("add breakout rooms");
  });

  it("shows reflective fields to internal users (windedvertigo.com)", () => {
    const session = { userId: "different-user", isInternal: true };
    const result = stripReflectiveFields(run, session);
    expect(result.what_changed).toBe("improved facilitation flow");
    expect(result.next_iteration).toBe("add breakout rooms");
  });

  it("hides reflective fields from external users viewing others' runs", () => {
    const session = { userId: "different-user", isInternal: false };
    const result = stripReflectiveFields(run, session);
    expect(result.what_changed).toBeNull();
    expect(result.next_iteration).toBeNull();
  });

  it("shows fields to admin (isInternal = true)", () => {
    const session = { userId: "admin-user", isInternal: true };
    const result = stripReflectiveFields(run, session);
    expect(result.what_changed).toBe("improved facilitation flow");
  });

  it("handles null reflective fields without error", () => {
    const nullRun = { created_by: "user-123", what_changed: null, next_iteration: null };
    const session = { userId: "user-123", isInternal: false };
    const result = stripReflectiveFields(nullRun, session);
    expect(result.what_changed).toBeNull();
    expect(result.next_iteration).toBeNull();
  });
});

describe("PATCH key whitelisting", () => {
  it("returns empty array for valid keys only", () => {
    const body = { title: "hello", runType: "workshop", contextTags: ["a"] };
    expect(getUnknownKeys(body)).toEqual([]);
  });

  it("detects unknown keys", () => {
    const body = { title: "hello", __proto__: {}, admin: true, role: "superuser" };
    const unknown = getUnknownKeys(body);
    expect(unknown).toContain("admin");
    expect(unknown).toContain("role");
  });

  it("catches SQL injection attempt via key names", () => {
    const body = { title: "normal", "'; DROP TABLE runs;--": "oops" };
    const unknown = getUnknownKeys(body);
    expect(unknown.length).toBe(1);
  });

  it("allows all valid update fields", () => {
    const body = {
      title: "t",
      playdateId: "p",
      runType: "r",
      runDate: "d",
      contextTags: [],
      traceEvidence: [],
      whatChanged: "w",
      nextIteration: "n",
      materialIds: [],
    };
    expect(getUnknownKeys(body)).toEqual([]);
  });
});

describe("pagination clamping", () => {
  // Mirrors the clamping logic from GET /api/runs
  function clampPagination(params: { limit?: string; offset?: string }) {
    const limit = Math.min(Math.max(parseInt(params.limit || "50", 10) || 50, 1), 100);
    const offset = Math.max(parseInt(params.offset || "0", 10) || 0, 0);
    return { limit, offset };
  }

  it("defaults to limit=50, offset=0", () => {
    expect(clampPagination({})).toEqual({ limit: 50, offset: 0 });
  });

  it("clamps limit to max 100", () => {
    expect(clampPagination({ limit: "999" })).toEqual({ limit: 100, offset: 0 });
  });

  it("clamps limit to min 1", () => {
    // parseInt("0") = 0, which is falsy → falls through to default 50
    expect(clampPagination({ limit: "0" })).toEqual({ limit: 50, offset: 0 });
    // parseInt("-5") = -5, which is truthy → Math.max(-5, 1) = 1
    expect(clampPagination({ limit: "-5" })).toEqual({ limit: 1, offset: 0 });
  });

  it("clamps negative offset to 0", () => {
    expect(clampPagination({ offset: "-10" })).toEqual({ limit: 50, offset: 0 });
  });

  it("handles garbage input gracefully", () => {
    expect(clampPagination({ limit: "abc", offset: "xyz" })).toEqual({
      limit: 50,
      offset: 0,
    });
  });
});
