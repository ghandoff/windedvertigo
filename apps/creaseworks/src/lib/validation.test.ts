/**
 * Tests for input validation helpers.
 *
 * Session 12 audit: first test file in the repo.
 */

import { describe, it, expect } from "vitest";
import {
  checkLength,
  truncate,
  sanitiseStringArray,
  isValidUuid,
  MAX_LENGTHS,
} from "./validation";

describe("checkLength", () => {
  it("returns null for strings within limit", () => {
    expect(checkLength("title", "hello", 500)).toBeNull();
  });

  it("returns error message for strings exceeding limit", () => {
    const result = checkLength("title", "a".repeat(501), 500);
    expect(result).toContain("title");
    expect(result).toContain("500");
  });

  it("returns null for non-string values", () => {
    expect(checkLength("field", 123, 500)).toBeNull();
    expect(checkLength("field", null, 500)).toBeNull();
  });

  it("allows exactly the max length", () => {
    expect(checkLength("title", "a".repeat(500), 500)).toBeNull();
  });
});

describe("truncate", () => {
  it("returns null for null/undefined", () => {
    expect(truncate(null, 100)).toBeNull();
    expect(truncate(undefined, 100)).toBeNull();
  });

  it("returns the string unchanged when within limit", () => {
    expect(truncate("hello", 100)).toBe("hello");
  });

  it("truncates at the limit", () => {
    expect(truncate("hello world", 5)).toBe("hello");
  });
});

describe("sanitiseStringArray", () => {
  it("returns empty array for non-array input", () => {
    expect(sanitiseStringArray(null)).toEqual([]);
    expect(sanitiseStringArray("not an array")).toEqual([]);
    expect(sanitiseStringArray(123)).toEqual([]);
  });

  it("filters out non-string items", () => {
    expect(sanitiseStringArray(["a", 1, "b", null, "c"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("limits array size", () => {
    const big = Array.from({ length: 100 }, (_, i) => `item${i}`);
    const result = sanitiseStringArray(big, 5);
    expect(result).toHaveLength(5);
  });

  it("truncates individual items", () => {
    const result = sanitiseStringArray(["a".repeat(200)], 50, 10);
    expect(result[0]).toHaveLength(10);
  });
});

describe("isValidUuid", () => {
  it("accepts valid v4 UUIDs", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects non-UUIDs", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid(123)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
  });
});

describe("MAX_LENGTHS", () => {
  it("has reasonable maximums", () => {
    expect(MAX_LENGTHS.title).toBeGreaterThanOrEqual(100);
    expect(MAX_LENGTHS.freeText).toBeGreaterThanOrEqual(1000);
    expect(MAX_LENGTHS.domain).toBe(253); // DNS max
    expect(MAX_LENGTHS.email).toBe(254); // RFC 5321
    expect(MAX_LENGTHS.uuid).toBe(36);
  });
});
