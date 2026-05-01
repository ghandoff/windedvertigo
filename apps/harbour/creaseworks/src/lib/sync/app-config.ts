import { sql } from "@/lib/db";
import { NOTION_DBS } from "@/lib/notion";
import { syncCacheTable } from "./sync-cache-table";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractNumber,
  extractLastEdited,
  extractPageId,
  type NotionPage,
} from "./extract";

function parseAppConfigPage(page: NotionPage) {
  const props = page.properties;
  return {
    notionId: extractPageId(page),
    name: extractTitle(props, "name"),
    key: extractSelect(props, "key"),
    group: extractSelect(props, "group"),
    sortOrder: extractNumber(props, "sort order") ?? 0,
    metadata: extractRichText(props, "metadata"),
    lastEdited: extractLastEdited(page),
  };
}

export async function syncAppConfig() {
  return syncCacheTable<ReturnType<typeof parseAppConfigPage>>({
    databaseId: NOTION_DBS.appConfig,
    label: "app-config",
    parsePage: parseAppConfigPage,
    upsertRow: async (row) => {
      await sql`
        INSERT INTO app_config_cache (
          notion_id, name, key, grp, sort_order, metadata,
          notion_last_edited, synced_at
        ) VALUES (
          ${row.notionId}, ${row.name}, ${row.key}, ${row.group},
          ${row.sortOrder}, ${row.metadata},
          ${row.lastEdited}, NOW()
        )
        ON CONFLICT (notion_id) DO UPDATE SET
          name = EXCLUDED.name,
          key = EXCLUDED.key,
          grp = EXCLUDED.grp,
          sort_order = EXCLUDED.sort_order,
          metadata = EXCLUDED.metadata,
          notion_last_edited = EXCLUDED.notion_last_edited,
          synced_at = NOW()
      `;
    },
    cleanupStale: async (activeNotionIds) => {
      await sql.query(
        `DELETE FROM app_config_cache
         WHERE notion_id != ALL($1::text[])`,
        [activeNotionIds],
      );
    },
  });
}
