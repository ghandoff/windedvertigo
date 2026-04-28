import type { Person, PersonEvent } from "./types";
import type { FuzzyDate } from "./db/utils";

/** extract a 4-digit year from a fuzzy date object */
function extractBirthYear(date: FuzzyDate | null): number | null {
  if (!date?.date) return null;
  const match = date.date.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/** heuristic: is this person likely still alive? */
export function isLikelyLiving(person: Person): boolean {
  const death = person.events.find((e) => e.event_type === "death");
  if (death) return false;
  if (person.is_living) return true;

  const birth = person.events.find((e) => e.event_type === "birth");
  if (!birth?.date) return true; // no dates = assume living

  const birthYear = extractBirthYear(birth.date);
  if (!birthYear) return true;

  return new Date().getFullYear() - birthYear < 110;
}

export type ViewerRole = "owner" | "editor" | "viewer" | null;

/**
 * redact a living person's details for non-owner views.
 * owners and editors see everything. viewers and anonymous
 * users see only initials + surname for living people.
 */
export function redactPerson(person: Person, viewerRole: ViewerRole): Person {
  if (viewerRole === "owner" || viewerRole === "editor") return person;
  if (!isLikelyLiving(person)) return person;

  return {
    ...person,
    events: [],
    notes: null,
    thumbnail_url: null,
    names: person.names.map((n) => ({
      ...n,
      given_names: n.given_names ? n.given_names.charAt(0) + "." : null,
      display: n.given_names
        ? [n.given_names.charAt(0) + ".", n.surname].filter(Boolean).join(" ")
        : n.surname ?? null,
      // keep surname for tree structure
    })),
  };
}
