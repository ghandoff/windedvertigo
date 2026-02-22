/**
 * Tests for auth helper utilities.
 *
 * Session 14 audit-1: integration test coverage for auth boundary logic.
 *
 * We mock the auth module to avoid pulling in next-auth → next/server
 * which isn't available in vitest without a full Next.js environment.
 */

import { describe, it, expect, vi } from "vitest";

// Mock the auth module before importing auth-helpers
vi.mock("./auth", () => ({
  auth: vi.fn(),
}));

// Also mock next/navigation (redirect)
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const { isInternalEmail } = await import("./auth-helpers");

describe("isInternalEmail", () => {
  it("returns true for windedvertigo.com emails", () => {
    expect(isInternalEmail("garrett@windedvertigo.com")).toBe(true);
    expect(isInternalEmail("admin@windedvertigo.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isInternalEmail("Garrett@WindedVertigo.COM")).toBe(true);
    expect(isInternalEmail("ADMIN@WINDEDVERTIGO.COM")).toBe(true);
  });

  it("returns false for other domains", () => {
    expect(isInternalEmail("user@gmail.com")).toBe(false);
    expect(isInternalEmail("user@example.com")).toBe(false);
    expect(isInternalEmail("user@windedvertigo.org")).toBe(false);
  });

  it("returns false for subdomains", () => {
    expect(isInternalEmail("user@sub.windedvertigo.com")).toBe(false);
  });

  it("returns false for malformed inputs", () => {
    expect(isInternalEmail("noatsign")).toBe(false);
    expect(isInternalEmail("")).toBe(false);
  });

  it("handles extra whitespace in domain", () => {
    expect(isInternalEmail("user@windedvertigo.com ")).toBe(true);
  });
});
