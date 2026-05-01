import { sql } from "@/lib/db";
import { NOTION_DBS } from "@/lib/notion";
import { syncCacheTable } from "./sync-cache-table";
import {
  extractTitle,
  extractRichText,
  extractRichTextHtml,
  extractSelect,
  extractNumber,
  extractLastEdited,
  extractPageId,
  type NotionPage,
} from "./extract";

function parseSiteCopyPage(page: NotionPage) {
  const props = page.properties;
  return {
    notionId: extractPageId(page),
    key: extractTitle(props, "key"),
    copy: extractRichText(props, "copy"),
    copyHtml: extractRichTextHtml(props, "copy"),
    page: extractSelect(props, "page"),
    section: extractSelect(props, "section"),
    status: extractSelect(props, "status") || "draft",
    sortOrder: extractNumber(props, "sort order") ?? 0,
    notes: extractRichText(props, "notes"),
    lastEdited: extractLastEdited(page),
  };
}

export async function syncSiteCopy() {
  return syncCacheTable<ReturnType<typeof parseSiteCopyPage>>({
    databaseId: NOTION_DBS.siteCopy,
    label: "site-copy",
    parsePage: parseSiteCopyPage,
    upsertRow: async (row) => {
      await sql`
        INSERT INTO site_copy_cache (
          notion_id, key, copy, copy_html, page, section,
          status, sort_order, notes,
          notion_last_edited, synced_at
        ) VALUES (
          ${row.notionId}, ${row.key}, ${row.copy}, ${row.copyHtml},
          ${row.page}, ${row.section}, ${row.status},
          ${row.sortOrder}, ${row.notes},
          ${row.lastEdited}, NOW()
        )
        ON CONFLICT (notion_id) DO UPDATE SET
          key = EXCLUDED.key,
          copy = EXCLUDED.copy,
          copy_html = EXCLUDED.copy_html,
          page = EXCLUDED.page,
          section = EXCLUDED.section,
          status = EXCLUDED.status,
          sort_order = EXCLUDED.sort_order,
          notes = EXCLUDED.notes,
          notion_last_edited = EXCLUDED.notion_last_edited,
          synced_at = NOW()
      `;
    },
    cleanupStale: async (activeNotionIds) => {
      await sql.query(
        `UPDATE site_copy_cache
         SET status = 'archived', synced_at = NOW()
         WHERE notion_id != ALL($1::text[])`,
        [activeNotionIds],
      );
    },
  });
}
