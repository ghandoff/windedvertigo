import { sql } from "@/lib/db";
import { NOTION_DBS } from "@/lib/notion";
import { syncCacheTable } from "./sync-cache-table";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractMultiSelect,
  extractDate,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
  assertPropertiesExist,
  type NotionPage,
} from "./extract";

/** Notion property names that must exist on every reflections page. */
const REQUIRED_NOTION_PROPS = [
  "reflection",       // title
  "context of use",   // select (was "reflection type")
  "date",
  "playdate",
  "context tags",
  "trace evidence captured",
];

function parseRunPage(page: NotionPage) {
  const props = page.properties;
  assertPropertiesExist(props, REQUIRED_NOTION_PROPS, page.id);
  const playdateIds = extractRelationIds(props, "playdate");
  return {
    notionId: extractPageId(page),
    title: extractTitle(props, "reflection"),
    playdateNotionId: playdateIds.length > 0 ? playdateIds[0] : null,
    runType: extractSelect(props, "context of use"),
    runDate: extractDate(props, "date"),
    contextTags: extractMultiSelect(props, "context tags"),
    traceEvidence: extractMultiSelect(props, "trace evidence captured"),
    whatChanged: extractRichText(props, "what changed"),
    nextIteration: extractRichText(props, "next iteration"),
    lastEdited: extractLastEdited(page),
    materialRelationIds: extractRelationIds(props, "materials used (actual)"),
  };
}

export async function syncRuns() {
  return syncCacheTable<ReturnType<typeof parseRunPage>>({
    databaseId: NOTION_DBS.reflections,
    label: "runs",
    parsePage: parseRunPage,
    upsertRow: async (row) => {
      await sql`
        INSERT INTO runs_cache (
          notion_id, title, playdate_notion_id, run_type, run_date,
          context_tags, trace_evidence, what_changed, next_iteration,
          notion_last_edited, synced_at, source
        ) VALUES (
          ${row.notionId}, ${row.title}, ${row.playdateNotionId},
          ${row.runType}, ${row.runDate},
          ${JSON.stringify(row.contextTags)},
          ${JSON.stringify(row.traceEvidence)},
          ${row.whatChanged}, ${row.nextIteration},
          ${row.lastEdited}, NOW(), 'notion'
        )
        ON CONFLICT (notion_id) DO UPDATE SET
          title = EXCLUDED.title,
          playdate_notion_id = EXCLUDED.playdate_notion_id,
          run_type = EXCLUDED.run_type,
          run_date = EXCLUDED.run_date,
          context_tags = EXCLUDED.context_tags,
          trace_evidence = EXCLUDED.trace_evidence,
          what_changed = EXCLUDED.what_changed,
          next_iteration = EXCLUDED.next_iteration,
          notion_last_edited = EXCLUDED.notion_last_edited,
          synced_at = NOW()
      `;
    },
    cleanupStale: async (activeNotionIds) => {
      // Only delete Notion-synced runs that no longer exist in Notion.
      // App-created runs (source = 'app') are never touched by sync.
      await sql.query(
        `DELETE FROM runs_cache WHERE source = 'notion' AND notion_id != ALL($1::text[])`,
        [activeNotionIds],
      );
    },
    resolveRelations: async (pages) => {
      // Resolve run → material relations
      for (const page of pages) {
        const row = parseRunPage(page);
        const runResult = await sql`
          SELECT id FROM runs_cache WHERE notion_id = ${row.notionId}
        `;
        if (runResult.rows.length === 0) continue;
        const runId = runResult.rows[0].id;

        await sql`DELETE FROM run_materials WHERE run_id = ${runId}`;

        for (const materialNotionId of row.materialRelationIds) {
          const materialResult = await sql`
            SELECT id FROM materials_cache WHERE notion_id = ${materialNotionId}
          `;
          if (materialResult.rows.length > 0) {
            await sql`
              INSERT INTO run_materials (run_id, material_id)
              VALUES (${runId}, ${materialResult.rows[0].id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    },
  });
}
