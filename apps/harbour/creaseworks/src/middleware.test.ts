/**
 * Tests for the CSRF protection (checkCsrf in lib/csrf.ts).
 *
 * Session 14 audit-1: verify that state-changing requests are rejected
 * when they come from a different origin or have no Origin/Referer.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { checkCsrf } from "./lib/csrf";

function makeRequest(
  method: string,
  path: string,
  opts: { origin?: string; referer?: string } = {},
): NextRequest {
  const url = `https://windedvertigo.com${path}`;
  const headers = new Headers();
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.referer) headers.set("referer", opts.referer);
  return new NextRequest(url, { method, headers });
}

/** Helper: checkCsrf returns null for allowed, NextResponse for blocked */
function isBlocked(method: string, path: string, opts?: { origin?: string; referer?: string }): boolean {
  return checkCsrf(makeRequest(method, path, opts)) !== null;
}

describe("CSRF protection (checkCsrf)", () => {
  // ── GET requests: always allowed ──────────────────────────
  it("allows GET requests without Origin", () => {
    expect(isBlocked("GET", "/api/runs")).toBe(false);
  });

  // ── Same-origin POST: allowed ─────────────────────────────
  it("allows POST with matching Origin", () => {
    expect(isBlocked("POST", "/api/runs", {
      origin: "https://windedvertigo.com",
    })).toBe(false);
  });

  it("allows PATCH with matching Origin", () => {
    expect(isBlocked("PATCH", "/api/runs/some-id", {
      origin: "https://windedvertigo.com",
    })).toBe(false);
  });

  it("allows DELETE with matching Origin", () => {
    expect(isBlocked("DELETE", "/api/admin/domains", {
      origin: "https://windedvertigo.com",
    })).toBe(false);
  });

  // ── Cross-origin POST: blocked ────────────────────────────
  it("blocks POST from a different Origin", async () => {
    const res = checkCsrf(makeRequest("POST", "/api/runs", {
      origin: "https://evil.com",
    }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain("cross-origin");
  });

  it("blocks PATCH from a different Origin", () => {
    expect(isBlocked("PATCH", "/api/runs/some-id", {
      origin: "https://attacker.example.com",
    })).toBe(true);
  });

  // ── Missing Origin, valid Referer: allowed ────────────────
  it("allows POST with matching Referer when Origin is missing", () => {
    expect(isBlocked("POST", "/api/runs", {
      referer: "https://windedvertigo.com/dashboard",
    })).toBe(false);
  });

  // ── Missing Origin, cross-site Referer: blocked ───────────
  it("blocks POST with cross-site Referer when Origin is missing", () => {
    expect(isBlocked("POST", "/api/runs", {
      referer: "https://evil.com/page",
    })).toBe(true);
  });

  // ── Missing both Origin and Referer: blocked ──────────────
  it("blocks POST with neither Origin nor Referer", async () => {
    const res = checkCsrf(makeRequest("POST", "/api/runs"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain("missing Origin");
  });

  // ── Exempt paths: webhooks and cron ───────────────────────
  it("allows Stripe webhook without Origin", () => {
    expect(isBlocked("POST", "/api/stripe/webhook")).toBe(false);
  });

  it("allows Notion webhook without Origin", () => {
    expect(isBlocked("POST", "/api/webhooks/notion")).toBe(false);
  });

  it("allows cron sync without Origin", () => {
    expect(isBlocked("POST", "/api/cron/sync-notion")).toBe(false);
  });

  // ── Invalid Origin header: blocked ────────────────────────
  it("blocks POST with malformed Origin", async () => {
    const res = checkCsrf(makeRequest("POST", "/api/runs", { origin: "not-a-url" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain("invalid Origin");
  });
});
