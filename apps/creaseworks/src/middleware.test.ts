/**
 * Tests for the CSRF protection middleware.
 *
 * Session 14 audit-1: verify that state-changing requests are rejected
 * when they come from a different origin or have no Origin/Referer.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function makeRequest(
  method: string,
  path: string,
  opts: { origin?: string; referer?: string } = {},
): NextRequest {
  const url = `https://creaseworks.windedvertigo.com${path}`;
  const headers = new Headers();
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.referer) headers.set("referer", opts.referer);
  return new NextRequest(url, { method, headers });
}

describe("CSRF middleware", () => {
  // ── GET requests: always allowed ──────────────────────────
  it("allows GET requests without Origin", () => {
    const res = middleware(makeRequest("GET", "/api/runs"));
    expect(res.status).not.toBe(403);
  });

  // ── Same-origin POST: allowed ─────────────────────────────
  it("allows POST with matching Origin", () => {
    const res = middleware(
      makeRequest("POST", "/api/runs", {
        origin: "https://creaseworks.windedvertigo.com",
      }),
    );
    expect(res.status).not.toBe(403);
  });

  it("allows PATCH with matching Origin", () => {
    const res = middleware(
      makeRequest("PATCH", "/api/runs/some-id", {
        origin: "https://creaseworks.windedvertigo.com",
      }),
    );
    expect(res.status).not.toBe(403);
  });

  it("allows DELETE with matching Origin", () => {
    const res = middleware(
      makeRequest("DELETE", "/api/admin/domains", {
        origin: "https://creaseworks.windedvertigo.com",
      }),
    );
    expect(res.status).not.toBe(403);
  });

  // ── Cross-origin POST: blocked ────────────────────────────
  it("blocks POST from a different Origin", async () => {
    const res = middleware(
      makeRequest("POST", "/api/runs", {
        origin: "https://evil.com",
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("cross-origin");
  });

  it("blocks PATCH from a different Origin", async () => {
    const res = middleware(
      makeRequest("PATCH", "/api/runs/some-id", {
        origin: "https://attacker.example.com",
      }),
    );
    expect(res.status).toBe(403);
  });

  // ── Missing Origin, valid Referer: allowed ────────────────
  it("allows POST with matching Referer when Origin is missing", () => {
    const res = middleware(
      makeRequest("POST", "/api/runs", {
        referer: "https://creaseworks.windedvertigo.com/dashboard",
      }),
    );
    expect(res.status).not.toBe(403);
  });

  // ── Missing Origin, cross-site Referer: blocked ───────────
  it("blocks POST with cross-site Referer when Origin is missing", async () => {
    const res = middleware(
      makeRequest("POST", "/api/runs", {
        referer: "https://evil.com/page",
      }),
    );
    expect(res.status).toBe(403);
  });

  // ── Missing both Origin and Referer: blocked ──────────────
  it("blocks POST with neither Origin nor Referer", async () => {
    const res = middleware(makeRequest("POST", "/api/runs"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("missing Origin");
  });

  // ── Exempt paths: webhooks and cron ───────────────────────
  it("allows Stripe webhook without Origin", () => {
    const res = middleware(makeRequest("POST", "/api/stripe/webhook"));
    expect(res.status).not.toBe(403);
  });

  it("allows Notion webhook without Origin", () => {
    const res = middleware(makeRequest("POST", "/api/webhooks/notion"));
    expect(res.status).not.toBe(403);
  });

  it("allows cron sync without Origin", () => {
    const res = middleware(makeRequest("POST", "/api/cron/sync-notion"));
    expect(res.status).not.toBe(403);
  });

  // ── Invalid Origin header: blocked ────────────────────────
  it("blocks POST with malformed Origin", async () => {
    const res = middleware(
      makeRequest("POST", "/api/runs", { origin: "not-a-url" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("invalid Origin");
  });
});
