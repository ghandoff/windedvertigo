import { sql } from "@/lib/db";
import { NOTION_DBS } from "@/lib/notion";
import { makeSlug } from "@/lib/slugify";
import { syncCacheTable } from "./sync-cache-table";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractNumber,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
  type NotionPage,
} from "./extract";

function parseCollectionPage(page: NotionPage) {
  const props = page.properties;
  return {
    notionId: extractPageId(page),
    title: extractTitle(props, "collection"),
    description: extractRichText(props, "description"),
    iconEmoji: extractRichText(props, "icon"),
    sortOrder: extractNumber(props, "sort order") ?? 0,
    status: extractSelect(props, "status") || "draft",
    lastEdited: extractLastEdited(page),
    playdateRelationIds: extractRelationIds(props, "playdates"),
  };
}

export async function syncCollections() {
  return syncCacheTable<ReturnType<typeof parseCollectionPage>>({
    databaseId: NOTION_DBS.collections,
    label: "collections",
    parsePage: parseCollectionPage,
    upsertRow: async (row) => {
      try {
        await sql`
          INSERT INTO collections (
            notion_id, title, description, icon_emoji, sort_order, status,
            notion_last_edited, synced_at, slug
          ) VALUES (
            ${row.notionId}, ${row.title}, ${row.description},
            ${row.iconEmoji}, ${row.sortOrder}, ${row.status},
            ${row.lastEdited}, NOW(), ${makeSlug(row.title)}
          )
          ON CONFLICT (notion_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            icon_emoji = EXCLUDED.icon_emoji,
            sort_order = EXCLUDED.sort_order,
            status = EXCLUDED.status,
            notion_last_edited = EXCLUDED.notion_last_edited,
            synced_at = NOW()
        `;
      } catch (err: any) {
        // Skip duplicate-slug orphan entries rather than failing the whole sync.
        // These arise from accidental collection entries that share a title with
        // an existing row but have a different notion_id.
        if (err.message?.includes("collections_slug_key")) {
          console.warn(
            `[sync] skipping duplicate slug "${makeSlug(row.title)}" ` +
              `for notion_id ${row.notionId} (orphan entry?)`,
          );
          return;
        }
        throw err;
      }
    },
    cleanupStale: async (activeNotionIds) => {
      // Soft-delete collections removed from Notion
      await sql.query(
        `UPDATE collections
         SET status = 'archived', synced_at = NOW()
         WHERE notion_id IS NOT NULL
           AND notion_id != ALL($1::text[])`,
        [activeNotionIds],
      );
    },
    resolveRelations: async (pages) => {
      // Resolve collection → playdate relations
      for (const page of pages) {
        const row = parseCollectionPage(page);
        const collResult = await sql`
          SELECT id FROM collections WHERE notion_id = ${row.notionId}
        `;
        if (collResult.rows.length === 0) continue;
        const collectionId = collResult.rows[0].id;

        await sql`DELETE FROM collection_playdates WHERE collection_id = ${collectionId}`;

        let displayOrder = 0;
        for (const playdateNotionId of row.playdateRelationIds) {
          const playdateResult = await sql`
            SELECT id FROM playdates_cache WHERE notion_id = ${playdateNotionId}
          `;
          if (playdateResult.rows.length > 0) {
            await sql`
              INSERT INTO collection_playdates (collection_id, playdate_id, display_order)
              VALUES (${collectionId}, ${playdateResult.rows[0].id}, ${displayOrder})
              ON CONFLICT DO NOTHING
            `;
            displayOrder++;
          }
        }
      }
    },
  });
}
