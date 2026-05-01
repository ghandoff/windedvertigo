import { NextResponse } from "next/server";

/**
 * Safely parse a JSON body from a Next.js request.
 *
 * Returns the parsed object, or a 400 NextResponse if the body is malformed.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  req: { json(): Promise<T> },
): Promise<T | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }
}

