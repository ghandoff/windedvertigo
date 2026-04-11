const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "windedvertigo-ancestry/1.0 (https://windedvertigo.com)";

// ---------- types ----------

export type WikidataResult = {
  wikidataId: string;
  name: string;
  description: string | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  fatherName: string | null;
  motherName: string | null;
  spouseName: string | null;
  occupation: string | null;
  wikipediaUrl: string | null;
};

export type WikidataPersonDetail = {
  wikidataId: string;
  name: string;
  description: string | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  occupation: string | null;
  imageUrl: string | null;
  wikipediaUrl: string | null;
  relationships: {
    type: string; // 'father', 'mother', 'spouse', 'child'
    name: string;
    wikidataId: string;
  }[];
};

// ---------- helpers ----------

async function sparqlQuery(query: string): Promise<Record<string, { value: string; type: string }>[]> {
  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`wikidata sparql: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data?.results?.bindings ?? [];
}

function extractId(uri: string): string {
  // "http://www.wikidata.org/entity/Q12345" -> "Q12345"
  return uri.split("/").pop() ?? uri;
}

function val(binding: Record<string, { value: string }>, key: string): string | null {
  return binding[key]?.value ?? null;
}

// ---------- public API ----------

export async function searchWikidata(params: {
  givenName: string;
  surname: string;
  birthYear?: number;
  deathYear?: number;
}): Promise<WikidataResult[]> {
  const fullName = `${params.givenName} ${params.surname}`.trim();
  if (!fullName) return [];

  let dateFilter = "";
  if (params.birthYear) {
    const lo = params.birthYear - 10;
    const hi = params.birthYear + 10;
    dateFilter += `
      OPTIONAL { ?person wdt:P569 ?birthDate. }
      FILTER(!BOUND(?birthDate) || (YEAR(?birthDate) >= ${lo} && YEAR(?birthDate) <= ${hi}))
    `;
  }
  if (params.deathYear) {
    const lo = params.deathYear - 10;
    const hi = params.deathYear + 10;
    dateFilter += `
      OPTIONAL { ?person wdt:P570 ?deathDate. }
      FILTER(!BOUND(?deathDate) || (YEAR(?deathDate) >= ${lo} && YEAR(?deathDate) <= ${hi}))
    `;
  }

  // if no date filters were added, we still need to fetch dates
  const needDates = !params.birthYear && !params.deathYear;
  const optionalDates = needDates
    ? `OPTIONAL { ?person wdt:P569 ?birthDate. }
       OPTIONAL { ?person wdt:P570 ?deathDate. }`
    : "";

  const escapedName = fullName.replace(/"/g, '\\"');

  const query = `
    SELECT DISTINCT ?person ?personLabel ?personDescription
           ?birthDate ?deathDate
           ?birthPlaceLabel ?deathPlaceLabel
           ?fatherLabel ?motherLabel ?spouseLabel
           ?occupationLabel ?article
    WHERE {
      ?person wdt:P31 wd:Q5.
      ?person rdfs:label ?label.
      FILTER(LANG(?label) = "en")
      FILTER(CONTAINS(LCASE(?label), LCASE("${escapedName}")))
      ${dateFilter}
      ${optionalDates}
      OPTIONAL { ?person wdt:P19 ?birthPlace. }
      OPTIONAL { ?person wdt:P20 ?deathPlace. }
      OPTIONAL { ?person wdt:P22 ?father. }
      OPTIONAL { ?person wdt:P25 ?mother. }
      OPTIONAL { ?person wdt:P26 ?spouse. }
      OPTIONAL { ?person wdt:P106 ?occupation. }
      OPTIONAL {
        ?article schema:about ?person;
                 schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 20
  `;

  const bindings = await sparqlQuery(query);

  // deduplicate by wikidata ID (multiple rows for multi-valued properties)
  const seen = new Map<string, WikidataResult>();

  for (const b of bindings) {
    const id = extractId(val(b, "person") ?? "");
    if (!id || seen.has(id)) continue;

    seen.set(id, {
      wikidataId: id,
      name: val(b, "personLabel") ?? fullName,
      description: val(b, "personDescription"),
      birthDate: val(b, "birthDate")?.slice(0, 10) ?? null,
      deathDate: val(b, "deathDate")?.slice(0, 10) ?? null,
      birthPlace: val(b, "birthPlaceLabel"),
      deathPlace: val(b, "deathPlaceLabel"),
      fatherName: val(b, "fatherLabel"),
      motherName: val(b, "motherLabel"),
      spouseName: val(b, "spouseLabel"),
      occupation: val(b, "occupationLabel"),
      wikipediaUrl: val(b, "article"),
    });
  }

  return [...seen.values()];
}

export async function getWikidataPerson(wikidataId: string): Promise<WikidataPersonDetail | null> {
  const query = `
    SELECT ?personLabel ?personDescription
           ?birthDate ?deathDate
           ?birthPlaceLabel ?deathPlaceLabel
           ?occupationLabel ?image ?article
           ?father ?fatherLabel
           ?mother ?motherLabel
           ?spouse ?spouseLabel
           ?child ?childLabel
    WHERE {
      BIND(wd:${wikidataId} AS ?person)
      ?person wdt:P31 wd:Q5.
      OPTIONAL { ?person wdt:P569 ?birthDate. }
      OPTIONAL { ?person wdt:P570 ?deathDate. }
      OPTIONAL { ?person wdt:P19 ?birthPlace. }
      OPTIONAL { ?person wdt:P20 ?deathPlace. }
      OPTIONAL { ?person wdt:P106 ?occupation. }
      OPTIONAL { ?person wdt:P18 ?image. }
      OPTIONAL { ?person wdt:P22 ?father. }
      OPTIONAL { ?person wdt:P25 ?mother. }
      OPTIONAL { ?person wdt:P26 ?spouse. }
      OPTIONAL { ?person wdt:P40 ?child. }
      OPTIONAL {
        ?article schema:about ?person;
                 schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 50
  `;

  const bindings = await sparqlQuery(query);
  if (bindings.length === 0) return null;

  const first = bindings[0];

  // collect all relationships across rows
  const relationships: WikidataPersonDetail["relationships"] = [];
  const relSeen = new Set<string>();

  for (const b of bindings) {
    for (const [prop, type] of [
      ["father", "father"],
      ["mother", "mother"],
      ["spouse", "spouse"],
      ["child", "child"],
    ] as const) {
      const uri = val(b, prop);
      const name = val(b, `${prop}Label`);
      if (uri && name) {
        const id = extractId(uri);
        const key = `${type}:${id}`;
        if (!relSeen.has(key)) {
          relSeen.add(key);
          relationships.push({ type, name, wikidataId: id });
        }
      }
    }
  }

  return {
    wikidataId,
    name: val(first, "personLabel") ?? wikidataId,
    description: val(first, "personDescription"),
    birthDate: val(first, "birthDate")?.slice(0, 10) ?? null,
    deathDate: val(first, "deathDate")?.slice(0, 10) ?? null,
    birthPlace: val(first, "birthPlaceLabel"),
    deathPlace: val(first, "deathPlaceLabel"),
    occupation: val(first, "occupationLabel"),
    imageUrl: val(first, "image"),
    wikipediaUrl: val(first, "article"),
    relationships,
  };
}
