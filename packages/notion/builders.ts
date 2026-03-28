/**
 * @windedvertigo/notion — property builders
 *
 * Convert plain TypeScript values into Notion API property format
 * for create/update operations. The inverse of extractors.
 */

import type { DateRange } from "./types";

/** Build a rich_text property from a plain string.
 *  Notion limits each text segment to 2000 chars; chunks automatically. */
export function buildRichText(value: string) {
  const LIMIT = 2000;
  if (value.length <= LIMIT) {
    return { rich_text: [{ text: { content: value } }] };
  }
  const chunks: { text: { content: string } }[] = [];
  for (let i = 0; i < value.length; i += LIMIT) {
    chunks.push({ text: { content: value.slice(i, i + LIMIT) } });
  }
  return { rich_text: chunks };
}

/** Build a title property from a plain string. */
export function buildTitle(value: string) {
  return { title: [{ text: { content: value } }] };
}

/** Build a select property from a value name. */
export function buildSelect(value: string) {
  return { select: { name: value } };
}

/** Build a multi-select property from a string array. */
export function buildMultiSelect(values: string[]) {
  return { multi_select: values.map((name) => ({ name })) };
}

/** Build a status property from a value name. */
export function buildStatus(value: string) {
  return { status: { name: value } };
}

/** Build a URL property. */
export function buildUrl(value: string) {
  return { url: value || null };
}

/** Build an email property. */
export function buildEmail(value: string) {
  return { email: value || null };
}

/** Build a phone_number property. */
export function buildPhone(value: string) {
  return { phone_number: value || null };
}

/** Build a number property. */
export function buildNumber(value: number | null) {
  return { number: value };
}

/** Build a checkbox property. */
export function buildCheckbox(value: boolean) {
  return { checkbox: value };
}

/** Build a date property from a DateRange. */
export function buildDate(value: DateRange | null) {
  if (!value) return { date: null };
  return {
    date: {
      start: value.start,
      ...(value.end ? { end: value.end } : {}),
    },
  };
}

/** Build a relation property from an array of page IDs. */
export function buildRelation(pageIds: string[]) {
  return { relation: pageIds.map((id) => ({ id })) };
}

/** Build a person property from an array of user IDs. */
export function buildPerson(userIds: string[]) {
  return { people: userIds.map((id) => ({ id })) };
}
