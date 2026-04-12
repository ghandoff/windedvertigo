/**
 * Chronicling America — Library of Congress newspaper archive.
 * Free, no auth required. Coverage: 1836-1963, US newspapers.
 * Good for: obituaries, birth/marriage announcements, news mentions.
 *
 * Uses the loc.gov search API (the old chroniclingamerica.loc.gov endpoint
 * was retired and redirects/404s as of 2025).
 *
 * API docs: https://www.loc.gov/apis/
 */

const BASE_URL = "https://www.loc.gov";

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
  state?: string; // full state name or two-letter code
}): Promise<NewspaperResult[]> {
  if (!params.name.trim()) return [];

  // use exact phrase match (quoted) so first and last name must appear together
  const searchParams = new URLSearchParams({
    q: `"${params.name}"`,
    fo: "json",
    c: "10",
  });

  // date range filter
  if (params.dateFrom && params.dateTo) {
    searchParams.set("dates", `${params.dateFrom}/${params.dateTo}`);
  } else if (params.dateFrom) {
    searchParams.set("dates", `${params.dateFrom}/`);
  } else if (params.dateTo) {
    searchParams.set("dates", `/${params.dateTo}`);
  }

  if (params.state) {
    searchParams.set("fa", `location_state:${params.state.toLowerCase()}`);
  }

  const url = `${BASE_URL}/newspapers/?${searchParams}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`chronicling america: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const items = data?.results ?? [];

  return items.map((item: {
    id?: string;
    title?: string;
    date?: string;
    url?: string;
    description?: string[];
    location_state?: string[];
    image_url?: string[];
  }) => {
    // extract OCR text from description
    const ocr = item.description?.[0] ?? "";
    const snippet = extractSnippet(ocr, params.name, 150);

    // extract newspaper name from title (format: "Image N of The Paper (City, State), Date")
    const titleMatch = item.title?.match(/Image \d+ of (.+?)(?:,|\()/);
    const newspaper = titleMatch?.[1]?.trim() ?? item.title ?? "unknown newspaper";

    // use the small thumbnail from image_url array
    const thumbnailUrl = item.image_url?.[0] ?? null;

    return {
      id: item.id ?? item.url ?? "",
      title: item.title ?? "newspaper page",
      newspaper,
      date: item.date ?? "",
      state: item.location_state?.[0] ?? null,
      pageUrl: item.url ?? item.id ?? "",
      thumbnailUrl,
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
