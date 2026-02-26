/**
 * Notion property extraction helpers.
 * Normalises all string values to lowercase on extract.
 */

import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export type NotionPage = PageObjectResponse;

/**
 * Notion properties are deeply nested discriminated unions. We use
 * Record<string, any> here because the SDK's union types make
 * property-level access extremely verbose without real safety gain —
 * each extract* helper already does its own runtime type check.
 */
type Properties = Record<string, any>;

function norm(value: string | null | undefined): string | null {
  return value ? value.toLowerCase().trim() : null;
}

export function extractTitle(props: Properties, key: string): string {
  const prop = props[key];
  if (!prop || prop.type !== "title") return "";
  const text = prop.title?.map((t: any) => t.plain_text).join("") ?? "";
  return text.toLowerCase().trim();
}

export function extractRichText(props: Properties, key: string): string | null {
  const prop = props[key];
  if (!prop || prop.type !== "rich_text") return null;
  const text = prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
  return text.trim() || null;
}

export function extractSelect(props: Properties, key: string): string | null {
  const prop = props[key];
  if (!prop) return null;
  // Handle both 'select' and 'status' types
  if (prop.type === "select") return norm(prop.select?.name);
  if (prop.type === "status") return norm(prop.status?.name);
  return null;
}

export function extractMultiSelect(props: Properties, key: string): string[] {
  const prop = props[key];
  if (!prop || prop.type !== "multi_select") return [];
  return (prop.multi_select ?? [])
    .map((opt: any) => opt.name?.toLowerCase().trim())
    .filter(Boolean);
}

export function extractCheckbox(props: Properties, key: string): boolean {
  const prop = props[key];
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox ?? false;
}

export function extractDate(props: Properties, key: string): string | null {
  const prop = props[key];
  if (!prop || prop.type !== "date" || !prop.date) return null;
  return prop.date.start ?? null;
}

export function extractRelationIds(props: Properties, key: string): string[] {
  const prop = props[key];
  if (!prop || prop.type !== "relation") return [];
  return (prop.relation ?? []).map((r: any) => r.id);
}

export function extractNumber(props: Properties, key: string): number | null {
  const prop = props[key];
  if (!prop || prop.type !== "number") return null;
  return prop.number ?? null;
}

export function extractLastEdited(page: NotionPage): string {
  return page.last_edited_time;
}

export function extractPageId(page: NotionPage): string {
  return page.id;
}

/**
 * Fail-loud check: assert that a Notion property exists in the page's
 * properties object. Used to catch property renames in Notion that
 * haven't been mirrored in the sync code.
 */
export function assertPropertiesExist(
  props: Properties,
  requiredKeys: string[],
  pageId: string,
): void {
  const missing = requiredKeys.filter((k) => !(k in props));
  if (missing.length > 0) {
    throw new Error(
      `[sync] Notion property mismatch on page ${pageId}: ` +
        `missing properties: ${missing.map((k) => `"${k}"`).join(", ")}. ` +
        `Check for Notion property renames.`,
    );
  }
}
