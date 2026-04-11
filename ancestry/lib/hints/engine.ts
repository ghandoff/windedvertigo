import type { Person, HintMatchData } from "../types";
import { isConfigured, searchPersons as fsSearch } from "../familysearch/client";
import { searchWikidata } from "../wikidata/client";
import { scoreMatch } from "./scoring";
import { upsertHint } from "../db/queries";

const MIN_CONFIDENCE = 30;
const RATE_LIMIT_MS = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// ---------- generate hints for a single person ----------

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

  let generated = 0;

  // --- familysearch ---
  if (isConfigured()) {
    try {
      const fsResults = await fsSearch({
        givenName: givenName || undefined,
        surname: surname || undefined,
        birthYear: birthYear?.toString(),
        birthPlace: birthPlace ?? undefined,
      });

      for (const r of fsResults) {
        const matchData: HintMatchData = {
          displayName: r.name,
          givenNames: r.givenName,
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

      await sleep(RATE_LIMIT_MS);
    } catch (err) {
      // don't let familysearch errors stop the whole process
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

      const matchData: HintMatchData = {
        displayName: r.name,
        givenNames: givenName, // wikidata returns full name, use search params
        surname: surname,
        birthDate: r.birthDate ?? undefined,
        birthPlace: r.birthPlace ?? undefined,
        deathDate: r.deathDate ?? undefined,
        deathPlace: r.deathPlace ?? undefined,
        sourceUrl: r.wikipediaUrl ?? `https://www.wikidata.org/wiki/${r.wikidataId}`,
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
