/**
 * Notion property extraction helpers.
 * Normalises all string values to lowercase on extract.
 */

type NotionPage = any; // Notion API page object
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

export function extractLastEdited(page: NotionPage): string {
  return page.last_edited_time;
}

export function extractPageId(page: NotionPage): string {
  return page.id;
}
