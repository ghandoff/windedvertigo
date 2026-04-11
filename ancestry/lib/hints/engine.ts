import type { Person, HintMatchData } from "../types";
import { isConfigured, searchPersons as fsSearch, searchRecords as fsSearchRecords } from "../familysearch/client";
import { searchWikidata } from "../wikidata/client";
import { searchNewspapers } from "../chronicling-america/client";
import { searchNARA } from "../nara/client";
import { searchDPLA, isConfigured as isDPLAConfigured } from "../dpla/client";
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
    try {
      const records = await fsSearchRecords({
        givenName: givenName || undefined,
        surname: surname || undefined,
        birthYear: birthYear?.toString(),
        birthPlace: birthPlace ?? undefined,
        deathYear: deathYear?.toString(),
      });

      for (const r of records) {
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

      await sleep(RATE_LIMIT_MS);
    } catch (err) {
      console.warn("hint engine: familysearch records error for person", person.id, err);
    }
  }

  // --- chronicling america (newspaper archives 1836-1963) ---
  try {
    const fullName = [givenName, surname].filter(Boolean).join(" ");
    if (fullName) {
      const npResults = await searchNewspapers({
        name: fullName,
        dateFrom: birthYear?.toString(),
        dateTo: deathYear ? String(deathYear + 5) : undefined,
      });

      for (const r of npResults) {
        const matchData: HintMatchData = {
          displayName: fullName,
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
        if (evidence.overallConfidence < MIN_CONFIDENCE) continue;

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
    }
  } catch (err) {
    console.warn("hint engine: chronicling america error for person", person.id, err);
  }

  // --- nara (national archives — census, military, immigration, land) ---
  try {
    const fullName = [givenName, surname].filter(Boolean).join(" ");
    if (fullName) {
      const naraResults = await searchNARA({
        name: fullName,
        dateFrom: birthYear?.toString(),
        dateTo: deathYear ? String(deathYear + 5) : undefined,
      });

      for (const r of naraResults) {
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
        if (evidence.overallConfidence < MIN_CONFIDENCE) continue;

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
    }
  } catch (err) {
    console.warn("hint engine: nara error for person", person.id, err);
  }

  // --- dpla (digital public library of america — obituaries, local histories, photos) ---
  if (isDPLAConfigured()) {
    try {
      const fullName = [givenName, surname].filter(Boolean).join(" ");
      if (fullName) {
        const dplaResults = await searchDPLA({
          name: fullName,
          dateFrom: birthYear?.toString(),
          dateTo: deathYear ? String(deathYear + 5) : undefined,
          place: birthPlace ?? undefined,
        });

        for (const r of dplaResults) {
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
          if (evidence.overallConfidence < MIN_CONFIDENCE) continue;

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
      }
    } catch (err) {
      console.warn("hint engine: dpla error for person", person.id, err);
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
