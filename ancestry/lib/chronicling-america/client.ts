/**
 * Chronicling America — Library of Congress newspaper archive API.
 * Free, no auth required. Coverage: 1836-1963, US newspapers.
 * Good for: obituaries, birth/marriage announcements, news mentions.
 *
 * API docs: https://chroniclingamerica.loc.gov/about/api/
 */

const BASE_URL = "https://chroniclingamerica.loc.gov";

export type NewspaperResult = {
  id: string;
  title: string;
  newspaper: string;
  date: string;
  state: string | null;
  pageUrl: string;
  thumbnailUrl: string | null;
  ocrSnippet: string | null;
};

/** search newspaper pages for a person's name within a date range */
export async function searchNewspapers(params: {
  name: string;
  dateFrom?: string; // YYYY format
  dateTo?: string;
  state?: string; // two-letter state code
}): Promise<NewspaperResult[]> {
  if (!params.name.trim()) return [];

  const searchParams = new URLSearchParams({
    andtext: params.name,
    format: "json",
    rows: "20",
    sort: "relevance",
  });

  if (params.dateFrom) searchParams.set("dateFilterType", "yearRange");
  if (params.dateFrom) searchParams.set("date1", params.dateFrom);
  if (params.dateTo) searchParams.set("date2", params.dateTo);
  if (params.state) searchParams.set("state", params.state);

  const url = `${BASE_URL}/search/pages/results/?${searchParams}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`chronicling america: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const items = data?.items ?? [];

  return items.map((item: {
    id?: string;
    title?: string;
    date?: string;
    url?: string;
    ocr_eng?: string;
    county?: string[];
    state?: string[];
    edition_label?: string;
    page?: string;
  }) => {
    // extract a short snippet from OCR text around the search term
    const ocr = item.ocr_eng ?? "";
    const snippet = extractSnippet(ocr, params.name, 150);

    return {
      id: item.id ?? item.url ?? "",
      title: `${item.title ?? "newspaper"} — ${item.date ?? ""}`,
      newspaper: item.title ?? "unknown newspaper",
      date: item.date ?? "",
      state: item.state?.[0] ?? null,
      pageUrl: item.url ? `${BASE_URL}${item.url}` : "",
      thumbnailUrl: item.id ? `${BASE_URL}${item.id}thumbnail.jpg` : null,
      ocrSnippet: snippet,
    } satisfies NewspaperResult;
  });
}

/** extract a snippet from OCR text centered around the search term */
function extractSnippet(text: string, term: string, maxLen: number): string | null {
  if (!text || !term) return null;

  const lower = text.toLowerCase();
  const termLower = term.toLowerCase();
  const idx = lower.indexOf(termLower);

  if (idx === -1) return text.slice(0, maxLen).trim() || null;

  const start = Math.max(0, idx - maxLen / 2);
  const end = Math.min(text.length, idx + term.length + maxLen / 2);
  let snippet = text.slice(start, end).trim();

  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet || null;
}
