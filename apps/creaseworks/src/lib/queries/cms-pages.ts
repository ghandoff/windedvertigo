/**
 * CMS page queries — fetch Notion-backed static pages from Postgres.
 *
 * These pages are synced from individual Notion pages (not databases)
 * via syncCmsPages(). Each page is keyed by a URL slug ("we", "do")
 * and stores rendered HTML body content.
 */

import { sql } from "@/lib/db";

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  body_html: string | null;
  meta_description: string | null;
  synced_at: string | null;
}

/**
 * Fetch a single CMS page by slug.
 * Returns null if the page hasn't been synced yet.
 */
export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  const result = await sql`
    SELECT id, slug, title, body_html, meta_description, synced_at
    FROM cms_pages
    WHERE slug = ${slug}
    LIMIT 1
  `;
  return (result.rows[0] as CmsPage) ?? null;
}
