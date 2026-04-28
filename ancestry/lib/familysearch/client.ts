import type { FuzzyDate } from "@/lib/db/utils";

const BASE_URL = "https://api.familysearch.org";

// ---------- types from FamilySearch API ----------

type FSName = {
  nameForms?: Array<{
    fullText?: string;
    parts?: Array<{ type: string; value: string }>;
  }>;
};

type FSDate = {
  original?: string;
  formal?: string; // e.g. "+1850-03-12"
};

type FSPlace = {
  original?: string;
};

type FSFact = {
  type?: string;
  date?: FSDate;
  place?: FSPlace;
};

type FSPerson = {
  id: string;
  gender?: { type?: string };
  names?: FSName[];
  facts?: FSFact[];
  display?: {
    name?: string;
    gender?: string;
    lifespan?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
  };
};

type FSRelationship = {
  type?: string;
  person1?: { resourceId: string };
  person2?: { resourceId: string };
};

// ---------- our simplified result types ----------

export type FamilySearchResult = {
  id: string;
  name: string;
  givenName: string;
  middleName: string | null;
  surname: string;
  sex: "M" | "F" | "U";
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  lifespan: string | null;
  score: number | null;
};

export type FamilySearchPerson = FamilySearchResult & {
  facts: Array<{
    type: string;
    date: string | null;
    place: string | null;
  }>;
};

export type FamilySearchFamily = {
  person: FamilySearchPerson;
  parents: FamilySearchPerson[];
  spouses: FamilySearchPerson[];
  children: FamilySearchPerson[];
};

// ---------- helpers ----------

function getToken(): string | null {
  return process.env.FAMILYSEARCH_ACCESS_TOKEN ?? null;
}

async function fsFetch(path: string): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("FAMILYSEARCH_ACCESS_TOKEN is not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) throw new Error("familysearch: unauthorized — check your access token");
  if (res.status === 429) throw new Error("familysearch: rate limited — try again later");
  if (res.status === 404) throw new Error("familysearch: not found");
  if (!res.ok) throw new Error(`familysearch: ${res.status} ${res.statusText}`);

  return res;
}

function parseSex(person: FSPerson): "M" | "F" | "U" {
  const g = person.gender?.type ?? person.display?.gender ?? "";
  if (g.includes("Male")) return "M";
  if (g.includes("Female")) return "F";
  return "U";
}

function parseGivenName(person: FSPerson): string {
  const parts = person.names?.[0]?.nameForms?.[0]?.parts;
  if (parts) {
    const given = parts.find((p) => p.type.includes("Given"));
    if (given) return given.value;
  }
  // fallback: split display name
  const full = person.display?.name ?? "";
  const segments = full.split(" ");
  return segments.slice(0, -1).join(" ") || full;
}

/** split "John William" into { first: "John", middle: "William" } */
function splitGivenNames(given: string): { first: string; middle: string | null } {
  const parts = given.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] ?? "", middle: null };
  return { first: parts[0], middle: parts.slice(1).join(" ") };
}

function parseSurname(person: FSPerson): string {
  const parts = person.names?.[0]?.nameForms?.[0]?.parts;
  if (parts) {
    const surname = parts.find((p) => p.type.includes("Surname"));
    if (surname) return surname.value;
  }
  const full = person.display?.name ?? "";
  const segments = full.split(" ");
  return segments.at(-1) ?? full;
}

/**
 * Parse a FamilySearch formal date string like "+1850-03-12" or "+1850"
 * into our FuzzyDate format.
 */
export function parseFSDate(formal?: string | null, original?: string | null): FuzzyDate | null {
  if (!formal && !original) return null;

  // formal dates look like "+1850-03-12", "+1850", "A+1850" (about), etc.
  const raw = formal ?? original ?? "";
  const cleaned = raw.replace(/^[A+]+/, "").replace(/^-/, "");

  if (!cleaned) return null;

  // detect precision
  const parts = cleaned.split("-");
  let precision: FuzzyDate["precision"] = "exact";
  let date = cleaned;

  if (parts.length === 1) {
    precision = "year";
    date = `${parts[0]}-01-01`;
  } else if (parts.length === 2) {
    precision = "month";
    date = `${parts[0]}-${parts[1]}-01`;
  }

  if (raw.startsWith("A")) precision = "about";

  return {
    precision,
    date,
    display: original ?? cleaned,
  };
}

function mapPerson(person: FSPerson, score?: number): FamilySearchPerson {
  const facts = (person.facts ?? []).map((f) => ({
    type: f.type?.replace(/.*\//, "").replace(/([A-Z])/g, " $1").trim().toLowerCase() ?? "unknown",
    date: f.date?.original ?? f.date?.formal ?? null,
    place: f.place?.original ?? null,
  }));

  const given = parseGivenName(person);
  const { first, middle } = splitGivenNames(given);

  return {
    id: person.id,
    name: person.display?.name ?? person.names?.[0]?.nameForms?.[0]?.fullText ?? "unknown",
    givenName: first,
    middleName: middle,
    surname: parseSurname(person),
    sex: parseSex(person),
    birthDate: person.display?.birthDate ?? null,
    birthPlace: person.display?.birthPlace ?? null,
    deathDate: person.display?.deathDate ?? null,
    deathPlace: person.display?.deathPlace ?? null,
    lifespan: person.display?.lifespan ?? null,
    score: score ?? null,
    facts,
  };
}

// ---------- public API ----------

export function isConfigured(): boolean {
  return !!getToken();
}

/** search for persons by name, birth year, birth place */
export async function searchPersons(params: {
  givenName?: string;
  surname?: string;
  birthYear?: string;
  birthPlace?: string;
}): Promise<FamilySearchResult[]> {
  const parts: string[] = [];
  if (params.givenName) parts.push(`givenName:${params.givenName}`);
  if (params.surname) parts.push(`surname:${params.surname}`);
  if (params.birthYear) parts.push(`birthDate:${params.birthYear}~`);
  if (params.birthPlace) parts.push(`birthPlace:${params.birthPlace}`);

  if (parts.length === 0) throw new Error("at least one search parameter is required");

  const q = encodeURIComponent(parts.join(" "));
  const res = await fsFetch(`/platform/tree/search?q=${q}&count=20`);
  const data = await res.json();

  const entries = data?.searchResults ?? [];

  return entries.map((entry: { id: string; score?: number; content?: { gedcomx?: { persons?: FSPerson[] } } }) => {
    const person = entry.content?.gedcomx?.persons?.[0];
    if (!person) return null;
    const given = parseGivenName(person);
    const { first, middle } = splitGivenNames(given);
    return {
      id: person.id,
      name: person.display?.name ?? "unknown",
      givenName: first,
      middleName: middle,
      surname: parseSurname(person),
      sex: parseSex(person),
      birthDate: person.display?.birthDate ?? null,
      birthPlace: person.display?.birthPlace ?? null,
      deathDate: person.display?.deathDate ?? null,
      deathPlace: person.display?.deathPlace ?? null,
      lifespan: person.display?.lifespan ?? null,
      score: entry.score ?? null,
    } satisfies FamilySearchResult;
  }).filter(Boolean) as FamilySearchResult[];
}

/** get a single person by FamilySearch ID */
export async function getPerson(personId: string): Promise<FamilySearchPerson> {
  const res = await fsFetch(`/platform/tree/persons/${personId}`);
  const data = await res.json();

  const person = data?.persons?.[0];
  if (!person) throw new Error(`person ${personId} not found`);

  return mapPerson(person);
}

/** get a person with their immediate family relationships */
export async function getPersonWithFamily(personId: string): Promise<FamilySearchFamily> {
  const res = await fsFetch(`/platform/tree/persons-with-relationships?person=${personId}`);
  const data = await res.json();

  const persons: FSPerson[] = data?.persons ?? [];
  const relationships: FSRelationship[] = data?.relationships ?? [];

  const primary = persons.find((p) => p.id === personId);
  if (!primary) throw new Error(`person ${personId} not found`);

  const personMap = new Map(persons.map((p) => [p.id, p]));

  const parents: FamilySearchPerson[] = [];
  const spouses: FamilySearchPerson[] = [];
  const children: FamilySearchPerson[] = [];

  for (const rel of relationships) {
    const type = rel.type ?? "";
    const p1 = rel.person1?.resourceId;
    const p2 = rel.person2?.resourceId;

    if (type.includes("ParentChild")) {
      if (p2 === personId && p1) {
        const parent = personMap.get(p1);
        if (parent) parents.push(mapPerson(parent));
      } else if (p1 === personId && p2) {
        const child = personMap.get(p2);
        if (child) children.push(mapPerson(child));
      }
    } else if (type.includes("Couple")) {
      const otherId = p1 === personId ? p2 : p1;
      if (otherId) {
        const spouse = personMap.get(otherId);
        if (spouse) spouses.push(mapPerson(spouse));
      }
    }
  }

  return {
    person: mapPerson(primary),
    parents,
    spouses,
    children,
  };
}

// ---------- historical records search ----------

export type FamilySearchRecord = {
  id: string;
  title: string;
  collectionTitle: string | null;
  recordType: string | null;
  personName: string | null;
  givenName: string | null;
  middleName: string | null;
  surname: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  eventDate: string | null;
  eventPlace: string | null;
  sourceUrl: string;
  score: number | null;
};

/** search FamilySearch historical records (birth, death, marriage, census, etc.) */
export async function searchRecords(params: {
  givenName?: string;
  surname?: string;
  birthYear?: string;
  birthPlace?: string;
  deathYear?: string;
  eventType?: string; // birth, death, marriage, census
}): Promise<FamilySearchRecord[]> {
  const parts: string[] = [];
  if (params.givenName) parts.push(`givenName:${params.givenName}`);
  if (params.surname) parts.push(`surname:${params.surname}`);
  if (params.birthYear) parts.push(`birthLikeDate.year:${params.birthYear}~`);
  if (params.birthPlace) parts.push(`birthLikePlace:${params.birthPlace}`);
  if (params.deathYear) parts.push(`deathLikeDate.year:${params.deathYear}~`);

  if (parts.length === 0) throw new Error("at least one search parameter is required");

  const q = encodeURIComponent(parts.join(" "));
  let url = `/platform/search/records?q=${q}&count=20`;

  // add collection filter for specific record types
  if (params.eventType) {
    const collectionFilters: Record<string, string> = {
      birth: "&collectionNameFilter=birth",
      death: "&collectionNameFilter=death",
      marriage: "&collectionNameFilter=marriage",
      census: "&collectionNameFilter=census",
    };
    if (collectionFilters[params.eventType]) {
      url += collectionFilters[params.eventType];
    }
  }

  const res = await fsFetch(url);
  const data = await res.json();

  const entries = data?.searchResults ?? [];

  return entries.map((entry: {
    id?: string;
    score?: number;
    title?: string;
    content?: {
      gedcomx?: {
        persons?: FSPerson[];
        sourceDescriptions?: Array<{ titles?: Array<{ value: string }>; about?: string }>;
      };
    };
  }) => {
    const person = entry.content?.gedcomx?.persons?.[0];
    const sourceDesc = entry.content?.gedcomx?.sourceDescriptions?.[0];

    const personDisplay = person?.display;

    // extract structured name from record person
    let recGiven: string | null = null;
    let recMiddle: string | null = null;
    let recSurname: string | null = null;
    if (person) {
      const fullGiven = parseGivenName(person);
      const { first, middle } = splitGivenNames(fullGiven);
      recGiven = first || null;
      recMiddle = middle;
      recSurname = parseSurname(person) || null;
    }

    return {
      id: entry.id ?? person?.id ?? "",
      title: sourceDesc?.titles?.[0]?.value ?? entry.title ?? "untitled record",
      collectionTitle: entry.title ?? null,
      recordType: guessRecordType(sourceDesc?.titles?.[0]?.value ?? entry.title ?? ""),
      personName: personDisplay?.name ?? null,
      givenName: recGiven,
      middleName: recMiddle,
      surname: recSurname,
      birthDate: personDisplay?.birthDate ?? null,
      birthPlace: personDisplay?.birthPlace ?? null,
      deathDate: personDisplay?.deathDate ?? null,
      deathPlace: personDisplay?.deathPlace ?? null,
      eventDate: personDisplay?.birthDate ?? personDisplay?.deathDate ?? null,
      eventPlace: personDisplay?.birthPlace ?? personDisplay?.deathPlace ?? null,
      sourceUrl: sourceDesc?.about ?? `https://www.familysearch.org/search/record/results?q=${q}`,
      score: entry.score ?? null,
    } satisfies FamilySearchRecord;
  }).filter((r: FamilySearchRecord) => r.id) as FamilySearchRecord[];
}

function guessRecordType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("birth")) return "birth";
  if (t.includes("death") || t.includes("burial")) return "death";
  if (t.includes("marriage") || t.includes("wedding")) return "marriage";
  if (t.includes("census")) return "census";
  if (t.includes("military") || t.includes("draft")) return "military";
  if (t.includes("immigration") || t.includes("passenger")) return "immigration";
  if (t.includes("church") || t.includes("baptism") || t.includes("christening")) return "church";
  if (t.includes("probate") || t.includes("will")) return "probate";
  return "other";
}
