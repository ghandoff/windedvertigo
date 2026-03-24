/**
 * @windedvertigo/notion — property extractors
 *
 * Convert Notion page properties into plain TypeScript values.
 * Ported from harbour/lib/notion.ts and extended with new types
 * needed for CRM (email, date, relation, checkbox, status, person, phone, place).
 */

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Prop, DateRange, Place } from "./types";

/** Extract plain text from a rich_text property. */
export function getText(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "rich_text")
    return prop.rich_text
      .map((t: { plain_text: string }) => t.plain_text)
      .join("");
  return "";
}

/** Extract plain text from a title property. */
export function getTitle(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "title")
    return prop.title
      .map((t: { plain_text: string }) => t.plain_text)
      .join("");
  return "";
}

/** Extract rich text as lightweight Markdown (bold, italic, links). */
export function getRichTextAsMarkdown(prop: Prop | undefined): string {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text
    .map((t: RichTextItemResponse) => {
      let text = t.plain_text;
      if (t.annotations?.bold) text = "**" + text + "**";
      if (t.annotations?.italic) text = "*" + text + "*";
      if (t.type === "text" && t.text?.link?.url)
        text = "[" + text + "](" + t.text.link.url + ")";
      return text;
    })
    .join("");
}

/** Extract a select property's name. */
export function getSelect(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name ?? "";
  return "";
}

/** Extract a multi-select property as a string array. */
export function getMultiSelect(prop: Prop | undefined): string[] {
  if (!prop) return [];
  if (prop.type === "multi_select")
    return prop.multi_select.map((s: { name: string }) => s.name);
  return [];
}

/** Extract a URL property. */
export function getUrl(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "url") return prop.url ?? "";
  return "";
}

/** Extract a number property. */
export function getNumber(prop: Prop | undefined): number | null {
  if (!prop) return null;
  if (prop.type === "number") return prop.number;
  return null;
}

/** Extract an email property. */
export function getEmail(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "email") return prop.email ?? "";
  return "";
}

/** Extract a phone_number property. */
export function getPhone(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "phone_number") return prop.phone_number ?? "";
  return "";
}

/** Extract a date property as { start, end }. */
export function getDate(prop: Prop | undefined): DateRange | null {
  if (!prop) return null;
  if (prop.type === "date" && prop.date)
    return { start: prop.date.start, end: prop.date.end ?? null };
  return null;
}

/** Extract a checkbox property. */
export function getCheckbox(prop: Prop | undefined): boolean {
  if (!prop) return false;
  if (prop.type === "checkbox") return prop.checkbox ?? false;
  return false;
}

/**
 * Extract a status property's name.
 * Status properties return { status: { name, color } } —
 * similar to select but with grouped options (to_do, in_progress, complete).
 */
export function getStatus(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "status") return prop.status?.name ?? "";
  return "";
}

/** Extract relation page IDs from a relation property. */
export function getRelation(prop: Prop | undefined): string[] {
  if (!prop) return [];
  if (prop.type === "relation")
    return prop.relation.map((r: { id: string }) => r.id);
  return [];
}

/** Extract person user IDs from a person property. */
export function getPerson(prop: Prop | undefined): string[] {
  if (!prop) return [];
  if (prop.type === "people")
    return prop.people.map((p: { id: string }) => p.id);
  return [];
}

/** Extract created_time property. */
export function getCreatedTime(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "created_time") return prop.created_time ?? "";
  return "";
}

/** Extract last_edited_time property. */
export function getLastEditedTime(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "last_edited_time") return prop.last_edited_time ?? "";
  return "";
}

/** Extract a created_by or last_edited_by user ID. */
export function getEditedBy(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "created_by" || prop.type === "last_edited_by")
    return prop[prop.type]?.id ?? "";
  return "";
}

/**
 * Extract a place property (location data).
 * Returns null if no place data is set.
 */
export function getPlace(prop: Prop | undefined): Place | null {
  if (!prop) return null;
  if (prop.type === "place" && prop.place) {
    return {
      name: prop.place.name ?? "",
      address: prop.place.address ?? "",
      latitude: prop.place.latitude ?? 0,
      longitude: prop.place.longitude ?? 0,
    };
  }
  return null;
}

/** Generate a URL-safe slug from a name. */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
