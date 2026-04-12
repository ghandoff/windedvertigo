import type { Person } from "../types";

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
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
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
  return maxLen === 0 ? 1 : 1 - levenshtein(la, lb) / maxLen;
}

// ---------- helpers ----------

function getPrimaryName(person: Person) {
  return person.names.find((n) => n.is_primary) ?? person.names[0];
}

function getAllNames(person: Person): { given: string; surname: string }[] {
  return person.names
    .filter((n) => n.given_names || n.surname)
    .map((n) => ({ given: n.given_names ?? "", surname: n.surname ?? "" }));
}

function extractYear(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function getBirthYear(person: Person): number | null {
  const birth = person.events.find((e) => e.event_type === "birth");
  return birth?.date ? extractYear(birth.date.date) : null;
}

function getDeathYear(person: Person): number | null {
  const death = person.events.find((e) => e.event_type === "death");
  return death?.date ? extractYear(death.date.date) : null;
}

function getBirthPlace(person: Person): string | null {
  const birth = person.events.find((e) => e.event_type === "birth");
  return birth?.description ?? null;
}

// ---------- scoring ----------

export type DuplicateMatch = {
  personA: Person;
  personB: Person;
  score: number;
  reasons: string[];
};

function scorePair(a: Person, b: Person): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // name comparison — check all name variants against each other
  const namesA = getAllNames(a);
  const namesB = getAllNames(b);
  let bestNameScore = 0;
  let bestNameReason = "";

  for (const na of namesA) {
    for (const nb of namesB) {
      const givenSim = similarity(na.given, nb.given);
      const surnameSim = similarity(na.surname, nb.surname);
      const combined = givenSim * 0.4 + surnameSim * 0.6;

      if (combined > bestNameScore) {
        bestNameScore = combined;
        if (combined >= 1) bestNameReason = `exact name match: ${na.given} ${na.surname}`;
        else if (combined > 0.8) bestNameReason = `close name match (${(combined * 100).toFixed(0)}%)`;
        else if (combined > 0.6) bestNameReason = `partial name match (${(combined * 100).toFixed(0)}%)`;
      }
    }
  }

  if (bestNameScore >= 1) { score += 40; reasons.push(bestNameReason); }
  else if (bestNameScore > 0.8) { score += 30; reasons.push(bestNameReason); }
  else if (bestNameScore > 0.6) { score += 20; reasons.push(bestNameReason); }
  else return { score: 0, reasons: [] }; // names too different, skip

  // sex check — mismatch is a strong negative signal
  if (a.sex && b.sex && a.sex !== "U" && b.sex !== "U") {
    if (a.sex !== b.sex) return { score: 0, reasons: [] }; // different sex = not duplicates
    score += 5;
    reasons.push("same sex");
  }

  // birth year
  const birthA = getBirthYear(a);
  const birthB = getBirthYear(b);
  if (birthA && birthB) {
    const diff = Math.abs(birthA - birthB);
    if (diff === 0) { score += 25; reasons.push(`same birth year (${birthA})`); }
    else if (diff <= 1) { score += 20; reasons.push(`birth year off by ${diff}`); }
    else if (diff <= 3) { score += 15; reasons.push(`birth year off by ${diff}`); }
    else if (diff <= 5) { score += 10; reasons.push(`birth year off by ${diff}`); }
    else if (diff > 10) return { score: 0, reasons: [] }; // too far apart
  }

  // death year
  const deathA = getDeathYear(a);
  const deathB = getDeathYear(b);
  if (deathA && deathB) {
    const diff = Math.abs(deathA - deathB);
    if (diff === 0) { score += 15; reasons.push(`same death year (${deathA})`); }
    else if (diff <= 3) { score += 10; reasons.push(`death year off by ${diff}`); }
    else if (diff > 10) { score -= 10; reasons.push(`death years far apart (${diff} years)`); }
  }

  // birth place
  const placeA = getBirthPlace(a)?.toLowerCase().trim();
  const placeB = getBirthPlace(b)?.toLowerCase().trim();
  if (placeA && placeB) {
    if (placeA === placeB) { score += 10; reasons.push("same birth place"); }
    else if (placeA.includes(placeB) || placeB.includes(placeA)) {
      score += 5; reasons.push("birth place partially matches");
    }
  }

  return { score: Math.max(0, score), reasons };
}

// ---------- public API ----------

const MIN_SCORE = 40; // minimum score to flag as potential duplicate

export function findDuplicates(persons: Person[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const { score, reasons } = scorePair(persons[i], persons[j]);
      if (score >= MIN_SCORE) {
        matches.push({ personA: persons[i], personB: persons[j], score, reasons });
      }
    }
  }

  // sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
