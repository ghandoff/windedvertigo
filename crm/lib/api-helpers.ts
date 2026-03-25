/**
 * Shared API route helpers — parse query params, handle errors.
 */

import { NextRequest, NextResponse } from "next/server";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Parse pagination + sort params from a request URL. */
export function parsePagination(req: NextRequest) {
  const url = new URL(req.url);
  return {
    cursor: url.searchParams.get("cursor") ?? undefined,
    pageSize: url.searchParams.has("pageSize")
      ? Math.min(Number(url.searchParams.get("pageSize")), 100)
      : undefined,
  };
}

export function parseSort(req: NextRequest) {
  const url = new URL(req.url);
  const sortBy = url.searchParams.get("sortBy");
  const sortDir = url.searchParams.get("sortDir") as
    | "ascending"
    | "descending"
    | null;
  if (!sortBy) return undefined;
  return { property: sortBy, direction: sortDir ?? ("descending" as const) };
}

/** Get a single query param, or undefined. */
export function param(req: NextRequest, key: string): string | undefined {
  return new URL(req.url).searchParams.get(key) ?? undefined;
}

/** Get a boolean query param. */
export function boolParam(
  req: NextRequest,
  key: string,
): boolean | undefined {
  const v = new URL(req.url).searchParams.get(key);
  if (v === null) return undefined;
  return v === "true" || v === "1";
}

/**
 * Wrap a handler with Notion error handling.
 *
 * The callback can return either:
 *  - A plain object → gets wrapped in json() with status 200
 *  - A NextResponse (e.g., from calling json(data, 201)) → passed through as-is
 *
 * This prevents the double-wrapping bug where json() is called twice.
 */
export async function withNotionError<T>(
  fn: () => Promise<T>,
): Promise<NextResponse> {
  try {
    const result = await fn();
    // If the callback already returned a NextResponse, pass it through
    if (result instanceof NextResponse) return result;
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api]", message);
    if (message.includes("Could not find") || message.includes("not found")) {
      return error("Not found", 404);
    }
    if (message.includes("validation")) {
      return error(message, 400);
    }
    return error("Internal server error", 500);
  }
}
