/**
 * NARA (National Archives) Catalog API
 * Free, API key recommended. Covers: census images, military records,
 * immigration/naturalization, land records, and more.
 *
 * API docs: https://www.archives.gov/research/catalog/help/api
 * Rate limit: 10,000 queries/month with API key
 */

const BASE_URL = "https://catalog.archives.gov/api/v2";

export type NARAResult = {
  id: string;
  title: string;
  recordType: string;
  date: string | null;
  place: string | null;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  naraId: string;
  /** names found in the record */
  personName: string | null;
  givenName: string | null;
  middleName: string | null;
  surname: string | null;
};

function getApiKey(): string | null {
  return process.env.NARA_API_KEY ?? null;
}

/** search NARA catalog for records mentioning a person */
export async function searchNARA(params: {
  name: string;
  dateFrom?: string;
  dateTo?: string;
  recordType?: string; // census, military, immigration, land
}): Promise<NARAResult[]> {
  if (!params.name.trim()) return [];

  const searchParams = new URLSearchParams({
    q: params.name,
    resultTypes: "item",
    rows: "15",
  });

  if (params.dateFrom) searchParams.set("dateRangeStart", params.dateFrom);
  if (params.dateTo) searchParams.set("dateRangeEnd", params.dateTo);

  // filter by record group for specific types
  if (params.recordType) {
    const recordGroups: Record<string, string> = {
      census: "29", // RG 29 = Bureau of the Census
      military: "94,15,407", // Adjutant General, VA, Army commands
      immigration: "85,36", // Immigration & Naturalization, Customs
      land: "49", // Bureau of Land Management
    };
    if (recordGroups[params.recordType]) {
      searchParams.set("recordGroupNumbers", recordGroups[params.recordType]);
    }
  }

  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const url = `${BASE_URL}/search?${searchParams}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`nara catalog: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const items = data?.body?.hits?.hits ?? data?.results ?? [];

  return items.slice(0, 15).map((item: {
    _id?: string;
    _source?: {
      description?: {
        item?: {
          title?: string;
          inclusiveDates?: { inclusiveDateText?: string };
          geographicReferences?: Array<{ termName?: string }>;
          scopeAndContentNote?: string;
          generalNoteArray?: Array<{ note?: string }>;
          personalContributorArray?: Array<{
            contributor?: { termName?: string };
          }>;
          productionDateArray?: Array<{ proposableQualifiableDate?: { dateQualifier?: string } }>;
        };
      };
      objects?: Array<{ thumbnail?: { url?: string }; file?: { url?: string } }>;
      naId?: number;
    };
  }) => {
    const source = item._source;
    const desc = source?.description?.item;
    const naId = String(source?.naId ?? item._id ?? "");

    // try to extract person name from contributors
    const contributors = desc?.personalContributorArray ?? [];
    const personName = contributors[0]?.contributor?.termName ?? null;

    // split name if available
    let given: string | null = null;
    let middle: string | null = null;
    let surname: string | null = null;
    if (personName) {
      // NARA names are often "Surname, Given Middle" format
      const commaParts = personName.split(",").map((s: string) => s.trim());
      if (commaParts.length >= 2) {
        surname = commaParts[0];
        const givenParts = commaParts[1].split(/\s+/);
        given = givenParts[0] ?? null;
        middle = givenParts.length > 1 ? givenParts.slice(1).join(" ") : null;
      } else {
        const spaceParts = personName.split(/\s+/);
        given = spaceParts[0] ?? null;
        middle = spaceParts.length > 2 ? spaceParts.slice(1, -1).join(" ") : null;
        surname = spaceParts.length > 1 ? spaceParts.at(-1) ?? null : null;
      }
    }

    const geo = desc?.geographicReferences?.[0]?.termName ?? null;
    const dateText = desc?.inclusiveDates?.inclusiveDateText ?? null;
    const thumbnail = source?.objects?.[0]?.thumbnail?.url ?? null;

    return {
      id: naId,
      title: desc?.title ?? "untitled record",
      recordType: guessNARARecordType(desc?.title ?? ""),
      date: dateText,
      place: geo,
      description: desc?.scopeAndContentNote?.slice(0, 300) ?? null,
      url: `https://catalog.archives.gov/id/${naId}`,
      thumbnailUrl: thumbnail,
      naraId: naId,
      personName,
      givenName: given,
      middleName: middle,
      surname,
    } satisfies NARAResult;
  });
}

function guessNARARecordType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("census") || t.includes("population schedule")) return "census";
  if (t.includes("military") || t.includes("enlistment") || t.includes("draft") || t.includes("pension") || t.includes("muster")) return "military";
  if (t.includes("passenger") || t.includes("immigration") || t.includes("naturalization") || t.includes("arrival")) return "immigration";
  if (t.includes("land") || t.includes("patent") || t.includes("homestead") || t.includes("deed")) return "land";
  if (t.includes("death") || t.includes("burial")) return "death";
  if (t.includes("birth")) return "birth";
  if (t.includes("marriage")) return "marriage";
  return "archival";
}

export function isConfigured(): boolean {
  // NARA works without a key (lower rate limit), but always "configured"
  return true;
}
