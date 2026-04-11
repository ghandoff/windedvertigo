/**
 * DPLA (Digital Public Library of America) API
 * Free, API key required (free, email tech@dp.la).
 * Aggregates 15M+ items from US libraries, archives, and museums.
 * Good for: obituaries, local histories, photos, county records, city directories.
 *
 * API docs: https://pro.dp.la/developers/api-codex
 */

const BASE_URL = "https://api.dp.la/v2";

export type DPLAResult = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  place: string | null;
  publisher: string | null;
  type: string | null;
  url: string;
  thumbnailUrl: string | null;
  provider: string | null;
};

function getApiKey(): string | null {
  return process.env.DPLA_API_KEY ?? null;
}

export function isConfigured(): boolean {
  return !!getApiKey();
}

/** search DPLA for items mentioning a person */
export async function searchDPLA(params: {
  name: string;
  dateFrom?: string;
  dateTo?: string;
  place?: string;
}): Promise<DPLAResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];
  if (!params.name.trim()) return [];

  const searchParams = new URLSearchParams({
    q: params.name,
    api_key: apiKey,
    page_size: "15",
  });

  if (params.dateFrom || params.dateTo) {
    // DPLA uses sourceResource.date.after and sourceResource.date.before
    if (params.dateFrom) searchParams.set("sourceResource.date.after", params.dateFrom);
    if (params.dateTo) searchParams.set("sourceResource.date.before", params.dateTo);
  }

  if (params.place) {
    searchParams.set("sourceResource.spatial", params.place);
  }

  const url = `${BASE_URL}/items?${searchParams}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`dpla: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const docs = data?.docs ?? [];

  return docs.map((doc: {
    id?: string;
    sourceResource?: {
      title?: string | string[];
      description?: string | string[];
      date?: Array<{ displayDate?: string }> | { displayDate?: string };
      spatial?: Array<{ name?: string }>;
      publisher?: string | string[];
      type?: string | string[];
    };
    isShownAt?: string;
    object?: string;
    provider?: { name?: string };
    dataProvider?: string;
  }) => {
    const sr = doc.sourceResource;
    const title = Array.isArray(sr?.title) ? sr.title[0] : sr?.title ?? "untitled";
    const desc = Array.isArray(sr?.description) ? sr.description[0] : sr?.description ?? null;
    const dateObj = Array.isArray(sr?.date) ? sr.date[0] : sr?.date;
    const date = dateObj?.displayDate ?? null;
    const place = sr?.spatial?.[0]?.name ?? null;
    const publisher = Array.isArray(sr?.publisher) ? sr.publisher[0] : sr?.publisher ?? null;
    const type = Array.isArray(sr?.type) ? sr.type[0] : sr?.type ?? null;

    return {
      id: doc.id ?? "",
      title: title?.slice(0, 200) ?? "untitled",
      description: desc?.slice(0, 300) ?? null,
      date,
      place,
      publisher,
      type,
      url: doc.isShownAt ?? `https://dp.la/item/${doc.id}`,
      thumbnailUrl: doc.object ?? null,
      provider: doc.dataProvider ?? doc.provider?.name ?? null,
    } satisfies DPLAResult;
  });
}
