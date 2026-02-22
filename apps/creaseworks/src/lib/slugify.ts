/**
 * Generate a URL-safe slug from a title string.
 * All lowercase, spaces to hyphens, strip non-alphanumeric.
 */
export function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
