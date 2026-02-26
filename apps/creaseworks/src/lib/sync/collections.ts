import { sql } from "@/lib/db";
import { queryAllPages, NOTION_DBS } from "@/lib/notion";
import { makeSlug } from "@/lib/slugify";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractNumber,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
  NotionPage,
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
  console.log("[sync] fetching collections from Notion...");
  const pages = await queryAllPages(NOTION_DBS.collections);
  console.log(`[sync] found ${pages.length} collections`);

  const notionIds: string[] = [];

  for (const page of pages) {
    const row = parseCollectionPage(page);
    notionIds.push(row.notionId);

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
  }

  if (notionIds.length > 0) {
    // Soft-delete collections removed from Notion
    await sql.query(
      `UPDATE collections
       SET status = 'archived', synced_at = NOW()
       WHERE notion_id IS NOT NULL
         AND notion_id != ALL($1::text[])`,
      [notionIds],
    );
  }

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

  console.log(`[sync] collections sync complete: ${pages.length} upserted`);
  return pages.length;
}
