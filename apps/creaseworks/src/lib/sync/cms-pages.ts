/**
 * CMS pages sync — individual Notion pages → Postgres.
 *
 * Unlike the database-driven syncCacheTable pattern, CMS pages are
 * identified by explicit page IDs in env vars. Each page is fetched
 * independently, its body rendered to HTML, and upserted to the
 * `cms_pages` table keyed by slug.
 *
 * This powers lightweight Notion-as-CMS for marketing pages (/we/, /do/)
 * without requiring a dedicated Notion database.
 */

import { sql } from "@/lib/db";
import { notion, getCmsPageConfigs, delay, RATE_LIMIT_DELAY_MS } from "@/lib/notion";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { extractTitle, extractRichText, extractLastEdited } from "./extract";
import { fetchPageBodyHtml } from "./blocks";

/**
 * Sync all configured CMS pages from Notion to Postgres.
 *
 * Returns the number of pages successfully synced.
 */
export async function syncCmsPages(): Promise<number> {
  const configs = getCmsPageConfigs();
  if (configs.length === 0) {
    console.log("[sync] cms-pages: no pages configured, skipping");
    return 0;
  }

  console.log(`[sync] cms-pages: syncing ${configs.length} page(s)…`);
  let synced = 0;

  for (const config of configs) {
    try {
      await delay(RATE_LIMIT_DELAY_MS);
      const page = (await notion().pages.retrieve({
        page_id: config.notionPageId,
      })) as PageObjectResponse;

      const props = page.properties;

      // CMS pages use a generic title property — try common names
      const title =
        extractTitle(props, "title") ||
        extractTitle(props, "name") ||
        extractTitle(props, "page") ||
        config.slug;

      const metaDescription = extractRichText(props, "meta description");
      const lastEdited = extractLastEdited(page);

      // Fetch full page body as HTML
      let bodyHtml: string | null = null;
      try {
        bodyHtml = await fetchPageBodyHtml(notion(), config.notionPageId);
      } catch {
        console.warn(
          `[sync] cms-pages: failed to fetch body for "${config.slug}"`,
        );
      }

      await sql`
        INSERT INTO cms_pages (
          slug, notion_page_id, title, body_html, meta_description,
          notion_last_edited, synced_at
        ) VALUES (
          ${config.slug}, ${config.notionPageId}, ${title},
          ${bodyHtml}, ${metaDescription}, ${lastEdited}, NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
          notion_page_id = EXCLUDED.notion_page_id,
          title = EXCLUDED.title,
          body_html = EXCLUDED.body_html,
          meta_description = EXCLUDED.meta_description,
          notion_last_edited = EXCLUDED.notion_last_edited,
          synced_at = NOW()
      `;

      synced++;
      console.log(`[sync] cms-pages: synced "${config.slug}"`);
    } catch (err) {
      console.error(
        `[sync] cms-pages: error syncing "${config.slug}" (${config.notionPageId}):`,
        err instanceof Error ? err.message : err,
      );
      // Continue with other pages — one failure shouldn't block the rest
    }
  }

  console.log(`[sync] cms-pages: ${synced}/${configs.length} synced`);
  return synced;
}
