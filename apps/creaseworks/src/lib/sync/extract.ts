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

export function extractUrl(props: Properties, key: string): string | null {
  const prop = props[key];
  if (!prop || prop.type !== "url") return null;
  return prop.url ?? null;
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

/* ------------------------------------------------------------------ */
/*  rich text → HTML extraction                                        */
/* ------------------------------------------------------------------ */

/**
 * Convert Notion's rich text array into lightweight HTML.
 *
 * Preserves: bold, italic, underline, strikethrough, code, links, colors.
 * Falls back to null if the result has no formatting (callers use plain text).
 *
 * The output is generated entirely from Notion's structured API response
 * (admin-controlled content), with all text content escaped via escapeHtml().
 * It is safe to render via a lightweight sanitiser or React's
 * dangerouslySetInnerHTML for this trusted source.
 */
export function extractRichTextHtml(
  props: Properties,
  key: string,
): string | null {
  const prop = props[key];
  if (!prop || prop.type !== "rich_text") return null;
  const segments: any[] = prop.rich_text ?? [];
  if (segments.length === 0) return null;

  let hasFormatting = false;
  const parts = segments.map((seg: any) => {
    const text = seg.plain_text ?? "";
    if (!text) return "";

    const ann = seg.annotations ?? {};
    let html = escapeHtml(text);

    // Wrap in formatting tags (innermost first)
    if (ann.code) { html = `<code>${html}</code>`; hasFormatting = true; }
    if (ann.strikethrough) { html = `<s>${html}</s>`; hasFormatting = true; }
    if (ann.underline) { html = `<u>${html}</u>`; hasFormatting = true; }
    if (ann.italic) { html = `<em>${html}</em>`; hasFormatting = true; }
    if (ann.bold) { html = `<strong>${html}</strong>`; hasFormatting = true; }

    // Color annotation — only non-default colors
    if (ann.color && ann.color !== "default") {
      html = `<span data-color="${ann.color}">${html}</span>`;
      hasFormatting = true;
    }

    // Links
    if (seg.href) {
      html = `<a href="${escapeAttr(seg.href)}">${html}</a>`;
      hasFormatting = true;
    }

    return html;
  });

  const result = parts.join("");
  if (!result.trim()) return null;

  // If no formatting was found, return null so callers fall back to plain text
  if (!hasFormatting) return null;

  return result;
}

/** Minimal HTML escaping for text content. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape for HTML attribute values. */
function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/*  file property extraction                                           */
/* ------------------------------------------------------------------ */

export interface NotionFileRef {
  url: string;
  name: string;
  expiry?: string;
}

/**
 * Extract file URLs from a Notion "files" (Files & media) property.
 *
 * Each file entry can be "external" (pasted URL) or "file" (uploaded
 * to Notion, with an expiring signed URL). We return both types
 * normalised to { url, name, expiry? }.
 */
export function extractFiles(props: Properties, key: string): NotionFileRef[] {
  const prop = props[key];
  if (!prop || prop.type !== "files") return [];
  return (prop.files ?? [])
    .map((f: any): NotionFileRef | null => {
      if (f.type === "external") {
        return { url: f.external?.url, name: f.name ?? "" };
      }
      if (f.type === "file") {
        return {
          url: f.file?.url,
          name: f.name ?? "",
          expiry: f.file?.expiry_time,
        };
      }
      return null;
    })
    .filter((f: NotionFileRef | null): f is NotionFileRef => f !== null && !!f.url);
}

/* ------------------------------------------------------------------ */
/*  page-level image extraction (covers + icons)                       */
/* ------------------------------------------------------------------ */

export interface NotionImage {
  url: string;
  expiry?: string; // notion's expiry_time for file-type images
}

/**
 * Extract the page cover image URL.
 * Handles both "external" (unsplash / pasted URL) and "file" (uploaded) covers.
 */
export function extractCover(page: NotionPage): NotionImage | null {
  const cover = (page as any).cover;
  if (!cover) return null;
  if (cover.type === "external") {
    return { url: cover.external.url };
  }
  if (cover.type === "file") {
    return { url: cover.file.url, expiry: cover.file.expiry_time };
  }
  return null;
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
