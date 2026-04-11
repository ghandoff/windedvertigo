import type { FuzzyDate } from "@/lib/db";

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

  return {
    id: person.id,
    name: person.display?.name ?? person.names?.[0]?.nameForms?.[0]?.fullText ?? "unknown",
    givenName: parseGivenName(person),
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
    return {
      id: person.id,
      name: person.display?.name ?? "unknown",
      givenName: parseGivenName(person),
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
