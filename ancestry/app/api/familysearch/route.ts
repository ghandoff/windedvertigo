import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { isConfigured, searchPersons } from "@/lib/familysearch/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "familysearch is not configured", configured: false },
      { status: 503 },
    );
  }

  const url = req.nextUrl;
  const givenName = url.searchParams.get("givenName") ?? undefined;
  const surname = url.searchParams.get("surname") ?? undefined;
  const birthYear = url.searchParams.get("birthYear") ?? undefined;
  const birthPlace = url.searchParams.get("birthPlace") ?? undefined;

  if (!givenName && !surname) {
    return NextResponse.json({ error: "provide at least a given name or surname" }, { status: 400 });
  }

  try {
    const results = await searchPersons({ givenName, surname, birthYear, birthPlace });
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const status = message.includes("rate limited") ? 429 : message.includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
