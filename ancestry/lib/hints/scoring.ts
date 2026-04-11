import type { Person, HintMatchData, HintEvidence } from "../types";

// ---------- levenshtein distance ----------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(la, lb) / maxLen;
}

// ---------- helpers ----------

function extractYear(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function normalizePlaceName(place: string | undefined | null): string {
  if (!place) return "";
  return place.toLowerCase().replace(/[,.\-]/g, " ").replace(/\s+/g, " ").trim();
}

function getPersonGivenNames(person: Person): string {
  const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
  return primary?.given_names ?? "";
}

function getPersonSurname(person: Person): string {
  const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
  return primary?.surname ?? "";
}

function getPersonBirthYear(person: Person): number | null {
  const birth = person.events.find((e) => e.event_type === "birth");
  if (!birth?.date) return null;
  return extractYear(birth.date.date);
}

function getPersonDeathYear(person: Person): number | null {
  const death = person.events.find((e) => e.event_type === "death");
  if (!death?.date) return null;
  return extractYear(death.date.date);
}

function getPersonBirthPlace(person: Person): string | null {
  const birth = person.events.find((e) => e.event_type === "birth");
  return birth?.description ?? null;
}

// ---------- scoring ----------

function scoreName(person: Person, match: HintMatchData): { score: number; details: string } {
  const givenSim = similarity(getPersonGivenNames(person), match.givenNames ?? "");
  const surnameSim = similarity(getPersonSurname(person), match.surname ?? "");

  // weighted: surname matters more for genealogy
  const combined = givenSim * 0.4 + surnameSim * 0.6;

  let score: number;
  let details: string;

  if (combined >= 1) {
    score = 40;
    details = "exact name match";
  } else if (combined > 0.8) {
    score = 30;
    details = `close name match (${(combined * 100).toFixed(0)}% similar)`;
  } else if (combined > 0.6) {
    score = 20;
    details = `partial name match (${(combined * 100).toFixed(0)}% similar)`;
  } else if (combined > 0.4) {
    score = 10;
    details = `weak name match (${(combined * 100).toFixed(0)}% similar)`;
  } else {
    score = 0;
    details = `poor name match (${(combined * 100).toFixed(0)}% similar)`;
  }

  return { score, details };
}

function scoreDate(person: Person, match: HintMatchData): { score: number; details: string } | undefined {
  const personBirth = getPersonBirthYear(person);
  const matchBirth = extractYear(match.birthDate);
  const personDeath = getPersonDeathYear(person);
  const matchDeath = extractYear(match.deathDate);

  let bestScore = 0;
  let details = "no date data to compare";

  function scorePair(personYear: number | null, matchYear: number | null, label: string) {
    if (personYear == null || matchYear == null) return;
    const diff = Math.abs(personYear - matchYear);
    let s: number;
    let d: string;

    if (diff === 0) {
      s = 30;
      d = `exact ${label} year match (${personYear})`;
    } else if (diff <= 1) {
      s = 25;
      d = `${label} year off by ${diff} (${personYear} vs ${matchYear})`;
    } else if (diff <= 3) {
      s = 20;
      d = `${label} year off by ${diff} (${personYear} vs ${matchYear})`;
    } else if (diff <= 5) {
      s = 15;
      d = `${label} year off by ${diff} (${personYear} vs ${matchYear})`;
    } else if (diff <= 10) {
      s = 10;
      d = `${label} year off by ${diff} (${personYear} vs ${matchYear})`;
    } else {
      s = 0;
      d = `${label} year too far apart (${diff} years)`;
    }

    if (s > bestScore) {
      bestScore = s;
      details = d;
    }
  }

  scorePair(personBirth, matchBirth, "birth");
  scorePair(personDeath, matchDeath, "death");

  if (bestScore === 0 && personBirth == null && personDeath == null && matchBirth == null && matchDeath == null) {
    return undefined; // no date data at all
  }

  return { score: bestScore, details };
}

function scorePlace(person: Person, match: HintMatchData): { score: number; details: string } | undefined {
  const personPlace = normalizePlaceName(getPersonBirthPlace(person));
  const matchPlace = normalizePlaceName(match.birthPlace);

  if (!personPlace || !matchPlace) return undefined;

  if (personPlace === matchPlace) {
    return { score: 15, details: "exact birth place match" };
  }

  if (personPlace.includes(matchPlace) || matchPlace.includes(personPlace)) {
    return { score: 10, details: "birth place partially matches" };
  }

  // check country-level match (last component)
  const personParts = personPlace.split(" ");
  const matchParts = matchPlace.split(" ");
  const personCountry = personParts[personParts.length - 1];
  const matchCountry = matchParts[matchParts.length - 1];

  if (personCountry && matchCountry && personCountry === matchCountry && personCountry.length > 2) {
    return { score: 5, details: `same country (${personCountry})` };
  }

  return { score: 0, details: "birth places do not match" };
}

function scoreFamily(
  person: Person,
  match: HintMatchData,
  existingPersons: Person[],
): { score: number; details: string } | undefined {
  const rels = match.relationships;
  if (!rels || rels.length === 0) return undefined;

  // build a set of lowercased names from existing persons in the tree
  const treeNames = new Set<string>();
  for (const p of existingPersons) {
    if (p.id === person.id) continue;
    for (const n of p.names) {
      if (n.display) treeNames.add(n.display.toLowerCase());
      const full = [n.given_names, n.surname].filter(Boolean).join(" ").toLowerCase();
      if (full) treeNames.add(full);
    }
  }

  if (treeNames.size === 0) return undefined;

  let matches = 0;
  const matchedNames: string[] = [];

  for (const rel of rels) {
    const relName = rel.name.toLowerCase();
    // check if any tree person name is similar
    for (const tn of treeNames) {
      if (similarity(relName, tn) > 0.8) {
        matches++;
        matchedNames.push(rel.name);
        break;
      }
    }
  }

  const score = Math.min(matches * 5, 15);
  const details = matches > 0
    ? `${matches} family name(s) match tree: ${matchedNames.join(", ")}`
    : "no family names match existing tree persons";

  return { score, details };
}

// ---------- public ----------

export function scoreMatch(
  person: Person,
  matchData: HintMatchData,
  existingPersons: Person[] = [],
): HintEvidence {
  const nameMatch = scoreName(person, matchData);
  const dateMatch = scoreDate(person, matchData);
  const placeMatch = scorePlace(person, matchData);
  const familyMatch = scoreFamily(person, matchData, existingPersons);

  const overallConfidence = Math.min(
    100,
    nameMatch.score
    + (dateMatch?.score ?? 0)
    + (placeMatch?.score ?? 0)
    + (familyMatch?.score ?? 0),
  );

  return {
    nameMatch,
    dateMatch,
    placeMatch,
    familyMatch,
    overallConfidence,
  };
}
