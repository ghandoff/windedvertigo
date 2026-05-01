import { sql } from "@/lib/db";
import { unstable_cache } from "next/cache";

export interface CopyBlock {
  key: string;
  copy: string;
  copyHtml: string | null;
  page: string | null;
  section: string | null;
  sortOrder: number;
}

/**
 * Fetch all live site copy for a given page.
 *
 * Returns a map keyed by the copy block's `key` field for O(1) lookups
 * in components. Falls back gracefully — if a key is missing, the
 * component can render its hard-coded default.
 *
 * Cached for 5 minutes via Next.js data cache (revalidated on sync).
 */
export const getCopyForPage = unstable_cache(
  async (page: string): Promise<Record<string, CopyBlock>> => {
    const result = await sql`
      SELECT key, copy, copy_html, page, section, sort_order
      FROM site_copy_cache
      WHERE page = ${page} AND status = 'live'
      ORDER BY sort_order ASC
    `;

    const map: Record<string, CopyBlock> = {};
    for (const row of result.rows) {
      map[row.key] = {
        key: row.key,
        copy: row.copy ?? "",
        copyHtml: row.copy_html,
        page: row.page,
        section: row.section,
        sortOrder: row.sort_order ?? 0,
      };
    }
    return map;
  },
  ["site-copy"],
  { revalidate: 300 },
);

/**
 * Fetch a single copy block by key.
 *
 * Returns the plain text `copy` value, or the provided fallback
 * if the key doesn't exist or isn't live yet. This makes gradual
 * migration safe — components keep working with hard-coded defaults
 * until the Notion copy goes live.
 */
export async function getCopy(key: string, fallback: string): Promise<string> {
  const result = await sql`
    SELECT copy FROM site_copy_cache
    WHERE key = ${key} AND status = 'live'
    LIMIT 1
  `;
  return result.rows[0]?.copy ?? fallback;
}

/**
 * Fetch multiple copy blocks by key prefix.
 *
 * Useful for fetching all items in a section, e.g. getCopyByPrefix("landing.features.")
 * returns all feature cards ordered by sort_order.
 */
export async function getCopyByPrefix(prefix: string): Promise<CopyBlock[]> {
  const result = await sql`
    SELECT key, copy, copy_html, page, section, sort_order
    FROM site_copy_cache
    WHERE key LIKE ${prefix + "%"} AND status = 'live'
    ORDER BY sort_order ASC
  `;
  return result.rows.map((row) => ({
    key: row.key,
    copy: row.copy ?? "",
    copyHtml: row.copy_html,
    page: row.page,
    section: row.section,
    sortOrder: row.sort_order ?? 0,
  }));
}
