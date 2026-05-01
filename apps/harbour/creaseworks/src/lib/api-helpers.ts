import { NextResponse } from "next/server";

/**
 * Safely parse a JSON request body.
 *
 * Returns the parsed body on success, or a 400 NextResponse on failure.
 * Usage:
 *
 *   const result = await parseJsonBody(req);
 *   if (result instanceof NextResponse) return result;
 *   const body = result;
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }
}

/**
 * Safely parse an optional JSON request body — empty body resolves to {}.
 *
 * Useful for endpoints that accept optional filter params.
 */
export async function parseOptionalJsonBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
