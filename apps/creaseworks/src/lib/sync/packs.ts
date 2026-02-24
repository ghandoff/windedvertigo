import { sql } from "@/lib/db";
import { queryAllPages, NOTION_DBS } from "@/lib/notion";
import { makeSlug } from "@/lib/slugify";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
} from "./extract";

function parsePackPage(page: any) {
  const props = page.properties;
  return {
    notionId: extractPageId(page),
    title: extractTitle(props, "pack"),
    description: extractRichText(props, "description"),
    status: extractSelect(props, "status") || "draft",
    lastEdited: extractLastEdited(page),
    playdateRelationIds: extractRelationIds(props, "playdates included"),
  };
}

export async function syncPacks() {
  console.log("[sync] fetching packs from Notion...");
  const pages = await queryAllPages(NOTION_DBS.packs);
  console.log(`[sync] found ${pages.length} packs`);

  const notionIds: string[] = [];

  for (const page of pages) {
    const row = parsePackPage(page);
    notionIds.push(row.notionId);

    await sql`
      INSERT INTO packs_cache (
        notion_id, title, description, status,
        notion_last_edited, synced_at, slug
      ) VALUES (
        ${row.notionId}, ${row.title}, ${row.description},
        ${row.status}, ${row.lastEdited}, NOW(), ${makeSlug(row.title)}
      )
      ON CONFLICT (notion_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        notion_last_edited = EXCLUDED.notion_last_edited,
        synced_at = NOW()
    `;
  }

  if (notionIds.length > 0) {
    // Soft-delete packs removed from Notion rather than hard-deleting,
    // because packs_catalogue and purchases reference packs_cache.
    await sql.query(
      `UPDATE packs_cache
       SET status = 'archived', synced_at = NOW()
       WHERE notion_id != ALL($1::text[])`,
      [notionIds],
    );
  }

  // Resolve pack → playdate relations
  for (const page of pages) {
    const row = parsePackPage(page);
    const packResult = await sql`
      SELECT id FROM packs_cache WHERE notion_id = ${row.notionId}
    `;
    if (packResult.rows.length === 0) continue;
    const packId = packResult.rows[0].id;

    await sql`DELETE FROM pack_playdates WHERE pack_id = ${packId}`;

    for (const playdateNotionId of row.playdateRelationIds) {
      const playdateResult = await sql`
        SELECT id FROM playdates_cache WHERE notion_id = ${playdateNotionId}
      `;
      if (playdateResult.rows.length > 0) {
        await sql`
          INSERT INTO pack_playdates (pack_id, playdate_id)
          VALUES (${packId}, ${playdateResult.rows[0].id})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }

  console.log(`[sync] packs sync complete: ${pages.length} upserted`);
  return pages.length;
}
