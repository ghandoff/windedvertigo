import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { searchRecords, isConfigured as isFSConfigured } from "@/lib/familysearch/client";
import { searchNewspapers } from "@/lib/chronicling-america/client";

export type RecordResult = {
  id: string;
  source: "familysearch" | "chronicling_america";
  title: string;
  recordType: string | null;
  personName: string | null;
  date: string | null;
  place: string | null;
  url: string;
  snippet: string | null;
  thumbnailUrl: string | null;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const givenName = params.get("givenName") ?? undefined;
  const surname = params.get("surname") ?? undefined;
  const birthYear = params.get("birthYear") ?? undefined;
  const deathYear = params.get("deathYear") ?? undefined;
  const place = params.get("place") ?? undefined;
  const recordType = params.get("recordType") ?? undefined;
  const sources = params.get("sources") ?? "all"; // all, familysearch, newspapers

  if (!givenName && !surname) {
    return NextResponse.json({ error: "at least givenName or surname is required" }, { status: 400 });
  }

  const results: RecordResult[] = [];
  const errors: string[] = [];

  // FamilySearch Records
  if ((sources === "all" || sources === "familysearch") && isFSConfigured()) {
    try {
      const fsResults = await searchRecords({
        givenName,
        surname,
        birthYear,
        birthPlace: place,
        deathYear,
        eventType: recordType,
      });

      for (const r of fsResults) {
        results.push({
          id: `fs-${r.id}`,
          source: "familysearch",
          title: r.title,
          recordType: r.recordType,
          personName: r.personName,
          date: r.eventDate,
          place: r.eventPlace,
          url: r.sourceUrl,
          snippet: null,
          thumbnailUrl: null,
        });
      }
    } catch (err) {
      errors.push(`FamilySearch: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  } else if (sources === "all" || sources === "familysearch") {
    errors.push("FamilySearch: access token not configured");
  }

  // Chronicling America (newspapers)
  if (sources === "all" || sources === "newspapers") {
    try {
      const fullName = [givenName, surname].filter(Boolean).join(" ");
      const npResults = await searchNewspapers({
        name: fullName,
        dateFrom: birthYear,
        dateTo: deathYear ? String(Number(deathYear) + 5) : undefined,
      });

      for (const r of npResults) {
        results.push({
          id: `ca-${r.id}`,
          source: "chronicling_america",
          title: r.title,
          recordType: "newspaper",
          personName: null,
          date: r.date,
          place: r.state,
          url: r.pageUrl,
          snippet: r.ocrSnippet,
          thumbnailUrl: r.thumbnailUrl,
        });
      }
    } catch (err) {
      errors.push(`Chronicling America: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return NextResponse.json({
    results,
    total: results.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
