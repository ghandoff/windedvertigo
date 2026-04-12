import type { Person, Relationship, HintMatchData } from "../types";
import { isConfigured, searchPersons as fsSearch, searchRecords as fsSearchRecords } from "../familysearch/client";
import { searchWikidata } from "../wikidata/client";
import { searchNewspapers } from "../chronicling-america/client";
import { searchNARA } from "../nara/client";
import { searchDPLA, isConfigured as isDPLAConfigured } from "../dpla/client";
import { scoreMatch } from "./scoring";
import { upsertHint, getTreeRelationships } from "../db/queries";

const MIN_CONFIDENCE = 40;
const MIN_CONFIDENCE_RECORDS = 50; // higher bar for newspaper/archive hits
const RATE_LIMIT_MS = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- US state abbreviation map for geographic filtering ----------

const US_STATES: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms", missouri: "mo",
  montana: "mt", nebraska: "ne", nevada: "nv", "new hampshire": "nh", "new jersey": "nj",
  "new mexico": "nm", "new york": "ny", "north carolina": "nc", "north dakota": "nd",
  ohio: "oh", oklahoma: "ok", oregon: "or", pennsylvania: "pa", "rhode island": "ri",
  "south carolina": "sc", "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut",
  vermont: "vt", virginia: "va", washington: "wa", "west virginia": "wv",
  wisconsin: "wi", wyoming: "wy",
};

const STATE_ABBREVS = new Set(Object.values(US_STATES));

/** extract US state from a place string like "Springfield, Illinois, USA" */
function extractStateFromPlace(place: string | null): string | null {
  if (!place) return null;
  const parts = place.split(",").map((p) => p.trim().toLowerCase());
  for (const part of parts) {
    if (US_STATES[part]) return part;
    if (part.length === 2 && STATE_ABBREVS.has(part)) return part;
  }
  return null;
}

// ---------- helpers to extract person data ----------

function getGivenNames(person: Person): string {
  const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
  return primary?.given_names ?? "";
}

function getSurname(person: Person): string {
  const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
  return primary?.surname ?? "";
}

function getBirthYear(person: Person): number | null {
  const birth = person.events.find((e) => e.event_type === "birth");
  if (!birth?.date) return null;
  const match = birth.date.date.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function getDeathYear(person: Person): number | null {
  const death = person.events.find((e) => e.event_type === "death");
  if (!death?.date) return null;
  const match = death.date.date.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function getBirthPlace(person: Person): string | null {
  const birth = person.events.find((e) => e.event_type === "birth");
  return birth?.description ?? null;
}

/** get all unique surnames from a person's name records (birth, married, alias) */
function getAllSurnames(person: Person): string[] {
  const surnames = new Set<string>();
  for (const name of person.names) {
    if (name.surname) surnames.add(name.surname);
  }
  return [...surnames];
}

/** get the first name from a person for display (e.g. "Robert" from "Robert James") */
function getFirstName(person: Person): string {
  const given = getGivenNames(person);
  return given.split(/\s+/)[0] ?? "";
}

/** look up family members using relationships */
function getFamilyContext(
  person: Person,
  existingPersons: Person[],
  relationships: Relationship[],
): { parents: Person[]; spouses: Person[] } {
  const personMap = new Map(existingPersons.map((p) => [p.id, p]));
  const parents: Person[] = [];
  const spouses: Person[] = [];

  for (const rel of relationships) {
    const parentTypes = ["biological_parent", "adoptive_parent", "foster_parent", "step_parent", "guardian"];

    if (parentTypes.includes(rel.relationship_type)) {
      // person1 is parent of person2
      if (rel.person2_id === person.id && rel.person1_id) {
        const parent = personMap.get(rel.person1_id);
        if (parent) parents.push(parent);
      }
    } else if (rel.relationship_type === "spouse" || rel.relationship_type === "partner") {
      const otherId = rel.person1_id === person.id ? rel.person2_id : rel.person1_id;
      if (otherId === person.id) continue; // self-reference guard
      if (rel.person1_id === person.id || rel.person2_id === person.id) {
        const spouse = personMap.get(otherId);
        if (spouse) spouses.push(spouse);
      }
    }
  }

  return { parents, spouses };
}

// ---------- generate hints for a single person ----------

/** cached relationships per tree to avoid re-fetching for each person */
let cachedRelationships: { treeId: string; rels: Relationship[] } | null = null;

async function getRelationshipsForTree(treeId: string): Promise<Relationship[]> {
  if (cachedRelationships?.treeId === treeId) return cachedRelationships.rels;
  const rels = await getTreeRelationships(treeId);
  cachedRelationships = { treeId, rels };
  return rels;
}

export async function generateHintsForPerson(
  treeId: string,
  person: Person,
  existingPersons: Person[],
): Promise<number> {
  const givenName = getGivenNames(person);
  const surname = getSurname(person);

  if (!givenName && !surname) return 0;

  const birthYear = getBirthYear(person);
  const birthPlace = getBirthPlace(person);
  const deathYear = getDeathYear(person);

  // gather alternate surnames (maiden name, married names, aliases)
  const allSurnames = getAllSurnames(person);
  const alternateSurnames = allSurnames.filter((s) => s !== surname);

  // look up family context for richer searches
  const relationships = await getRelationshipsForTree(treeId);
  const family = getFamilyContext(person, existingPersons, relationships);
  const parentNames = family.parents.map((p) => ({
    given: getFirstName(p),
    surname: getSurname(p),
  })).filter((n) => n.given || n.surname);
  const spouseNames = family.spouses.map((p) => ({
    given: getFirstName(p),
    surname: getSurname(p),
  })).filter((n) => n.given || n.surname);

  let generated = 0;

  // track seen external IDs to avoid duplicate hints from alternate-name searches
  const seenExternalIds = new Set<string>();

  // helper to process FamilySearch person results and upsert hints
  async function processFSPersonResults(results: Awaited<ReturnType<typeof fsSearch>>, source: string) {
    for (const r of results) {
      if (seenExternalIds.has(`fs-${r.id}`)) continue;
      seenExternalIds.add(`fs-${r.id}`);

      const matchData: HintMatchData = {
        displayName: r.name,
        givenNames: r.givenName,
        middleName: r.middleName ?? undefined,
        surname: r.surname,
        birthDate: r.birthDate ?? undefined,
        birthPlace: r.birthPlace ?? undefined,
        deathDate: r.deathDate ?? undefined,
        deathPlace: r.deathPlace ?? undefined,
        sex: r.sex,
        sourceUrl: `https://www.familysearch.org/tree/person/details/${r.id}`,
      };

      const evidence = scoreMatch(person, matchData, existingPersons);
      if (evidence.overallConfidence < MIN_CONFIDENCE) continue;

      const id = await upsertHint({
        treeId,
        personId: person.id,
        sourceSystem: "familysearch",
        externalId: r.id,
        matchData,
        confidence: evidence.overallConfidence,
        evidence,
      });

      if (id) generated++;
    }
  }

  // --- familysearch ---
  if (isConfigured()) {
    try {
      // primary search with current surname
      const fsResults = await fsSearch({
        givenName: givenName || undefined,
        surname: surname || undefined,
        birthYear: birthYear?.toString(),
        birthPlace: birthPlace ?? undefined,
      });
      await processFSPersonResults(fsResults, "primary");
      await sleep(RATE_LIMIT_MS);

      // search with alternate surnames (maiden name, etc.)
      for (const altSurname of alternateSurnames) {
        const altResults = await fsSearch({
          givenName: givenName || undefined,
          surname: altSurname,
          birthYear: birthYear?.toString(),
          birthPlace: birthPlace ?? undefined,
        });
        await processFSPersonResults(altResults, `alt:${altSurname}`);
        await sleep(RATE_LIMIT_MS);
      }

      // search with spouse surname (catches married-name records)
      for (const sp of spouseNames) {
        if (sp.surname && sp.surname !== surname && !allSurnames.includes(sp.surname)) {
          const spResults = await fsSearch({
            givenName: givenName || undefined,
            surname: sp.surname,
            birthYear: birthYear?.toString(),
          });
          await processFSPersonResults(spResults, `spouse:${sp.surname}`);
          await sleep(RATE_LIMIT_MS);
        }
      }
    } catch (err) {
      console.warn("hint engine: familysearch error for person", person.id, err);
    }
  }

  // --- wikidata ---
  try {
    const wdResults = await searchWikidata({
      givenName,
      surname,
      birthYear: birthYear ?? undefined,
      deathYear: deathYear ?? undefined,
    });

    for (const r of wdResults) {
      const relationships: HintMatchData["relationships"] = [];
      if (r.fatherName) relationships.push({ type: "father", name: r.fatherName, externalId: undefined });
      if (r.motherName) relationships.push({ type: "mother", name: r.motherName, externalId: undefined });
      if (r.spouseName) relationships.push({ type: "spouse", name: r.spouseName, externalId: undefined });

      // extract structured name from wikidata full name
      const wdNameParts = r.name.trim().split(/\s+/);
      const wdFirstName = wdNameParts[0] ?? "";
      const wdMiddleName = wdNameParts.length > 2 ? wdNameParts.slice(1, -1).join(" ") : undefined;
      const wdSurname = wdNameParts.length > 1 ? wdNameParts.at(-1) ?? "" : "";

      const matchData: HintMatchData = {
        displayName: r.name,
        givenNames: wdFirstName,
        middleName: wdMiddleName,
        surname: wdSurname,
        birthDate: r.birthDate ?? undefined,
        birthPlace: r.birthPlace ?? undefined,
        deathDate: r.deathDate ?? undefined,
        deathPlace: r.deathPlace ?? undefined,
        sourceUrl: r.wikipediaUrl ?? `https://www.wikidata.org/wiki/${r.wikidataId}`,
        imageUrl: r.imageUrl ?? undefined,
        relationships: relationships.length > 0 ? relationships : undefined,
      };

      const evidence = scoreMatch(person, matchData, existingPersons);
      if (evidence.overallConfidence < MIN_CONFIDENCE) continue;

      const id = await upsertHint({
        treeId,
        personId: person.id,
        sourceSystem: "wikidata",
        externalId: r.wikidataId,
        matchData,
        confidence: evidence.overallConfidence,
        evidence,
      });

      if (id) generated++;
    }

    await sleep(RATE_LIMIT_MS);
  } catch (err) {
    console.warn("hint engine: wikidata error for person", person.id, err);
  }

  // --- familysearch historical records (birth certs, census, marriage, death) ---
  if (isConfigured()) {
    // helper to process FS record results
    async function processFSRecordResults(records: Awaited<ReturnType<typeof fsSearchRecords>>) {
      for (const r of records) {
        if (seenExternalIds.has(`fsr-${r.id}`)) continue;
        seenExternalIds.add(`fsr-${r.id}`);

        const matchData: HintMatchData = {
          displayName: r.personName ?? r.title,
          givenNames: r.givenName ?? givenName,
          middleName: r.middleName ?? undefined,
          surname: r.surname ?? surname,
          birthDate: r.birthDate ?? undefined,
          birthPlace: r.birthPlace ?? undefined,
          deathDate: r.deathDate ?? undefined,
          deathPlace: r.deathPlace ?? undefined,
          eventDate: r.eventDate ?? undefined,
          eventPlace: r.eventPlace ?? undefined,
          sourceUrl: r.sourceUrl,
          recordType: r.recordType ?? undefined,
          collectionTitle: r.collectionTitle ?? undefined,
        };

        const evidence = scoreMatch(person, matchData, existingPersons);
        if (evidence.overallConfidence < MIN_CONFIDENCE) continue;

        const id = await upsertHint({
          treeId,
          personId: person.id,
          sourceSystem: "familysearch_records",
          externalId: r.id,
          matchData,
          confidence: evidence.overallConfidence,
          evidence,
        });

        if (id) generated++;
      }
    }

    try {
      // primary search
      const records = await fsSearchRecords({
        givenName: givenName || undefined,
        surname: surname || undefined,
        birthYear: birthYear?.toString(),
        birthPlace: birthPlace ?? undefined,
        deathYear: deathYear?.toString(),
      });
      await processFSRecordResults(records);
      await sleep(RATE_LIMIT_MS);

      // search with alternate surnames
      for (const altSurname of alternateSurnames) {
        const altRecords = await fsSearchRecords({
          givenName: givenName || undefined,
          surname: altSurname,
          birthYear: birthYear?.toString(),
          birthPlace: birthPlace ?? undefined,
          deathYear: deathYear?.toString(),
        });
        await processFSRecordResults(altRecords);
        await sleep(RATE_LIMIT_MS);
      }
    } catch (err) {
      console.warn("hint engine: familysearch records error for person", person.id, err);
    }
  }

  // --- chronicling america (newspaper archives 1836-1963) ---
  // build all name variants to search
  const nameVariants = new Set<string>();
  const primaryFullName = [givenName, surname].filter(Boolean).join(" ");
  if (primaryFullName && givenName && surname) nameVariants.add(primaryFullName);
  for (const altSurname of alternateSurnames) {
    if (givenName && altSurname) {
      const altName = [givenName, altSurname].filter(Boolean).join(" ");
      nameVariants.add(altName);
    }
  }

  // extract state from birth place for geographic filtering
  const birthState = extractStateFromPlace(birthPlace);

  for (const searchName of nameVariants) {
    try {
      const npResults = await searchNewspapers({
        name: searchName,
        dateFrom: birthYear?.toString(),
        dateTo: deathYear ? String(deathYear + 5) : undefined,
        state: birthState ?? undefined,
      });

      for (const r of npResults) {
        if (seenExternalIds.has(`ca-${r.id}`)) continue;
        seenExternalIds.add(`ca-${r.id}`);

        // validate that the OCR snippet actually contains the full name as a phrase
        if (r.ocrSnippet) {
          const snippetLower = r.ocrSnippet.toLowerCase();
          const nameLower = searchName.toLowerCase();
          if (!snippetLower.includes(nameLower)) continue; // skip fragmented matches
        }

        const matchData: HintMatchData = {
          displayName: searchName,
          givenNames: givenName,
          surname: surname,
          sourceUrl: r.pageUrl,
          recordType: "newspaper",
          collectionTitle: r.newspaper,
          snippet: r.ocrSnippet ?? undefined,
          imageUrl: r.thumbnailUrl ?? undefined,
          eventDate: r.date || undefined,
          eventPlace: r.state ?? undefined,
        };

        const evidence = scoreMatch(person, matchData, existingPersons);
        if (evidence.overallConfidence < MIN_CONFIDENCE_RECORDS) continue;

        const id = await upsertHint({
          treeId,
          personId: person.id,
          sourceSystem: "chronicling_america",
          externalId: r.id,
          matchData,
          confidence: evidence.overallConfidence,
          evidence,
        });

        if (id) generated++;
      }

      await sleep(RATE_LIMIT_MS);
    } catch (err) {
      console.warn("hint engine: chronicling america error for", searchName, err);
    }
  }

  // --- nara (national archives — census, military, immigration, land) ---
  for (const searchName of nameVariants) {
    try {
      const naraResults = await searchNARA({
        name: searchName,
        dateFrom: birthYear?.toString(),
        dateTo: deathYear ? String(deathYear + 5) : undefined,
      });

      for (const r of naraResults) {
        if (seenExternalIds.has(`nara-${r.naraId}`)) continue;
        seenExternalIds.add(`nara-${r.naraId}`);

        const matchData: HintMatchData = {
          displayName: r.personName ?? r.title,
          givenNames: r.givenName ?? givenName,
          middleName: r.middleName ?? undefined,
          surname: r.surname ?? surname,
          sourceUrl: r.url,
          recordType: r.recordType,
          eventDate: r.date ?? undefined,
          eventPlace: r.place ?? undefined,
          imageUrl: r.thumbnailUrl ?? undefined,
        };

        const evidence = scoreMatch(person, matchData, existingPersons);
        if (evidence.overallConfidence < MIN_CONFIDENCE_RECORDS) continue;

        const id = await upsertHint({
          treeId,
          personId: person.id,
          sourceSystem: "nara",
          externalId: r.naraId,
          matchData,
          confidence: evidence.overallConfidence,
          evidence,
        });

        if (id) generated++;
      }

      await sleep(RATE_LIMIT_MS);
    } catch (err) {
      console.warn("hint engine: nara error for", searchName, err);
    }
  }

  // --- dpla (digital public library of america — obituaries, local histories, photos) ---
  if (isDPLAConfigured()) {
    for (const searchName of nameVariants) {
      try {
        const dplaResults = await searchDPLA({
          name: searchName,
          dateFrom: birthYear?.toString(),
          dateTo: deathYear ? String(deathYear + 5) : undefined,
          place: birthPlace ?? undefined,
        });

        for (const r of dplaResults) {
          if (seenExternalIds.has(`dpla-${r.id}`)) continue;
          seenExternalIds.add(`dpla-${r.id}`);

          const matchData: HintMatchData = {
            displayName: r.title,
            givenNames: givenName,
            surname: surname,
            sourceUrl: r.url,
            recordType: r.type ?? "archival",
            collectionTitle: r.publisher ?? r.provider ?? undefined,
            eventDate: r.date ?? undefined,
            eventPlace: r.place ?? undefined,
            imageUrl: r.thumbnailUrl ?? undefined,
          };

          const evidence = scoreMatch(person, matchData, existingPersons);
          if (evidence.overallConfidence < MIN_CONFIDENCE_RECORDS) continue;

          const id = await upsertHint({
            treeId,
            personId: person.id,
            sourceSystem: "dpla",
            externalId: r.id,
            matchData,
            confidence: evidence.overallConfidence,
            evidence,
          });

          if (id) generated++;
        }

        await sleep(RATE_LIMIT_MS);
      } catch (err) {
        console.warn("hint engine: dpla error for", searchName, err);
      }
    }
  }

  return generated;
}

// ---------- generate hints for an entire tree ----------

export async function generateHintsForTree(
  treeId: string,
  persons: Person[],
): Promise<{ generated: number; skipped: number }> {
  let generated = 0;
  let skipped = 0;

  for (const person of persons) {
    const givenName = getGivenNames(person);
    const surname = getSurname(person);

    if (!givenName && !surname) {
      skipped++;
      continue;
    }

    const count = await generateHintsForPerson(treeId, person, persons);
    generated += count;
  }

  return { generated, skipped };
}
