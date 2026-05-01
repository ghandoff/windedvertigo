/**
 * Tests for search query functions.
 *
 * Mocks sql.query() to verify:
 *  - Pattern construction (ILIKE wrapping)
 *  - Short query early-return
 *  - Result structure from searchPlaydates / searchCollections
 *  - Combined search returns both result sets
 *
 * P2-7: test coverage expansion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  sql: { query: (...args: any[]) => mockQuery(...args) },
}));

const { searchPlaydates, searchCollections, search } = await import("./search");

beforeEach(() => {
  mockQuery.mockReset();
});

/* ------------------------------------------------------------------ */
/*  searchPlaydates                                                     */
/* ------------------------------------------------------------------ */

describe("searchPlaydates", () => {
  it("wraps query in ILIKE pattern", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await searchPlaydates("clay");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("%clay%");
    expect(params[1]).toBe(20); // default limit
  });

  it("passes custom limit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await searchPlaydates("paint", 5);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(5);
  });

  it("returns playdate results with expected shape", async () => {
    const mockResults = [
      {
        id: "pd-1",
        slug: "clay-pinch-pot",
        title: "Clay Pinch Pot",
        headline: "Make a small vessel",
        primary_function: "sculpting",
        cover_url: null,
        icon_emoji: null,
        match_field: "title",
        collection_title: "Nature Detectives",
        collection_slug: "nature-detectives",
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockResults });

    const results = await searchPlaydates("clay");
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe("clay-pinch-pot");
    expect(results[0].match_field).toBe("title");
    expect(results[0].collection_title).toBe("Nature Detectives");
  });

  it("returns empty array for no matches", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const results = await searchPlaydates("xyznoexist");
    expect(results).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  searchCollections                                                   */
/* ------------------------------------------------------------------ */

describe("searchCollections", () => {
  it("wraps query in ILIKE pattern", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await searchCollections("nature");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("%nature%");
    expect(params[1]).toBe(10); // default limit
  });

  it("returns collection results with playdate count", async () => {
    const mockResults = [
      {
        id: "col-1",
        slug: "nature-detectives",
        title: "Nature Detectives",
        description: "Outdoor discovery activities",
        icon_emoji: "🌿",
        cover_url: null,
        playdate_count: 5,
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockResults });

    const results = await searchCollections("nature");
    expect(results).toHaveLength(1);
    expect(results[0].playdate_count).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/*  search (combined)                                                   */
/* ------------------------------------------------------------------ */

describe("search", () => {
  it("returns empty results for queries shorter than 2 chars", async () => {
    const result = await search("a");
    expect(result).toEqual({ playdates: [], collections: [], query: "a" });
    // No database queries should be made
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns empty results for empty string", async () => {
    const result = await search("");
    expect(result).toEqual({ playdates: [], collections: [], query: "" });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns empty results for whitespace-only", async () => {
    const result = await search("   ");
    expect(result).toEqual({ playdates: [], collections: [], query: "" });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("trims whitespace from query", async () => {
    // searchPlaydates
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // searchCollections
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await search("  clay  ");
    expect(result.query).toBe("clay");
    // Verify the trimmed query was used for the pattern
    const [, playdateParams] = mockQuery.mock.calls[0];
    expect(playdateParams[0]).toBe("%clay%");
  });

  it("runs playdates and collections search in parallel", async () => {
    const playdateRows = [
      {
        id: "pd-1",
        slug: "clay-pinch-pot",
        title: "Clay Pinch Pot",
        headline: null,
        primary_function: null,
        cover_url: null,
        icon_emoji: null,
        match_field: "title",
        collection_title: null,
        collection_slug: null,
      },
    ];
    const collectionRows = [
      {
        id: "col-1",
        slug: "color-lab",
        title: "Color Lab",
        description: "Color mixing activities",
        icon_emoji: "🎨",
        cover_url: null,
        playdate_count: 3,
      },
    ];

    // Both queries resolve
    mockQuery.mockResolvedValueOnce({ rows: playdateRows });
    mockQuery.mockResolvedValueOnce({ rows: collectionRows });

    const result = await search("co");
    expect(result.playdates).toHaveLength(1);
    expect(result.collections).toHaveLength(1);
    expect(result.query).toBe("co");
  });
});
