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
    patternRelationIds: extractRelationIds(props, "patterns included"),
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
    await sql.query(
      `DELETE FROM packs_cache WHERE notion_id != ALL($1::text[])`,
      [notionIds],
    );
  }

  // Resolve pack → pattern relations
  for (const page of pages) {
    const row = parsePackPage(page);
    const packResult = await sql`
      SELECT id FROM packs_cache WHERE notion_id = ${row.notionId}
    `;
    if (packResult.rows.length === 0) continue;
    const packId = packResult.rows[0].id;

    await sql`DELETE FROM pack_patterns WHERE pack_id = ${packId}`;

    for (const patternNotionId of row.patternRelationIds) {
      const patternResult = await sql`
        SELECT id FROM patterns_cache WHERE notion_id = ${patternNotionId}
      `;
      if (patternResult.rows.length > 0) {
        await sql`
          INSERT INTO pack_patterns (pack_id, pattern_id)
          VALUES (${packId}, ${patternResult.rows[0].id})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }

  console.log(`[sync] packs sync complete: ${pages.length} upserted`);
  return pages.length;
}
