import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { searchRecords, isConfigured as isFSConfigured } from "@/lib/familysearch/client";
import { searchNewspapers } from "@/lib/chronicling-america/client";
import { searchNARA } from "@/lib/nara/client";
import { searchDPLA, isConfigured as isDPLAConfigured } from "@/lib/dpla/client";

export type RecordResult = {
  id: string;
  source: "familysearch" | "chronicling_america" | "nara" | "dpla";
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

  if (!givenName && !surname) {
    return NextResponse.json({ error: "at least givenName or surname is required" }, { status: 400 });
  }

  const fullName = [givenName, surname].filter(Boolean).join(" ");
  const results: RecordResult[] = [];
  const errors: string[] = [];

  // run all searches in parallel for speed
  const searches = await Promise.allSettled([
    // FamilySearch Records
    isFSConfigured()
      ? searchRecords({
          givenName,
          surname,
          birthYear,
          birthPlace: place,
          deathYear,
          eventType: recordType,
        }).then((fsResults) =>
          fsResults.map((r) => ({
            id: `fs-${r.id}`,
            source: "familysearch" as const,
            title: r.title,
            recordType: r.recordType,
            personName: r.personName,
            date: r.eventDate,
            place: r.eventPlace,
            url: r.sourceUrl,
            snippet: null,
            thumbnailUrl: null,
          }))
        )
      : Promise.reject(new Error("access token not configured")),

    // Chronicling America
    fullName
      ? searchNewspapers({
          name: fullName,
          dateFrom: birthYear,
          dateTo: deathYear ? String(Number(deathYear) + 5) : undefined,
        }).then((npResults) =>
          npResults.map((r) => ({
            id: `ca-${r.id}`,
            source: "chronicling_america" as const,
            title: r.title,
            recordType: "newspaper",
            personName: null,
            date: r.date,
            place: r.state,
            url: r.pageUrl,
            snippet: r.ocrSnippet,
            thumbnailUrl: r.thumbnailUrl,
          }))
        )
      : Promise.resolve([]),

    // NARA (National Archives)
    fullName
      ? searchNARA({
          name: fullName,
          dateFrom: birthYear,
          dateTo: deathYear ? String(Number(deathYear) + 5) : undefined,
          recordType,
        }).then((naraResults) =>
          naraResults.map((r) => ({
            id: `nara-${r.id}`,
            source: "nara" as const,
            title: r.title,
            recordType: r.recordType,
            personName: r.personName,
            date: r.date,
            place: r.place,
            url: r.url,
            snippet: r.description,
            thumbnailUrl: r.thumbnailUrl,
          }))
        )
      : Promise.resolve([]),

    // DPLA
    isDPLAConfigured() && fullName
      ? searchDPLA({
          name: fullName,
          dateFrom: birthYear,
          dateTo: deathYear ? String(Number(deathYear) + 5) : undefined,
          place,
        }).then((dplaResults) =>
          dplaResults.map((r) => ({
            id: `dpla-${r.id}`,
            source: "dpla" as const,
            title: r.title,
            recordType: r.type ?? "archival",
            personName: null,
            date: r.date,
            place: r.place,
            url: r.url,
            snippet: r.description,
            thumbnailUrl: r.thumbnailUrl,
          }))
        )
      : Promise.resolve([]),
  ]);

  const sourceNames = ["FamilySearch", "Chronicling America", "National Archives", "Digital Public Library"];
  searches.forEach((result, i) => {
    if (result.status === "fulfilled") {
      results.push(...(result.value as RecordResult[]));
    } else {
      errors.push(`${sourceNames[i]}: ${result.reason?.message ?? "unknown error"}`);
    }
  });

  return NextResponse.json({
    results,
    total: results.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
