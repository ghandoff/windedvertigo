/**
 * Slugify a material title for URL use.
 *
 * Extracted to its own module (no db import) so it's safe to
 * use in both server and client components.
 */
export function materialSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
