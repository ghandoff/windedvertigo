import { sql } from "@/lib/db";
import { queryAllPages, NOTION_DBS } from "@/lib/notion";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractMultiSelect,
  extractCheckbox,
  extractLastEdited,
  extractPageId,
} from "./extract";

function parseMaterialPage(page: any) {
  const props = page.properties;
  return {
    notionId: extractPageId(page),
    title: extractTitle(props, "material"),
    formPrimary: extractSelect(props, "form (primary)"),
    functions: extractMultiSelect(props, "functions"),
    connectorModes: extractMultiSelect(props, "connector modes"),
    contextTags: extractMultiSelect(props, "context tags"),
    doNotUse: extractCheckbox(props, "do not use"),
    doNotUseReason: extractSelect(props, "do not use reason"),
    shareability: extractRichText(props, "shareability"),
    minQtySize: extractRichText(props, "min qty / size"),
    examplesNotes: extractRichText(props, "examples / notes"),
    generationNotes: extractRichText(props, "generation notes"),
    generationPrompts: extractMultiSelect(props, "generation prompts"),
    source: extractSelect(props, "source"),
    lastEdited: extractLastEdited(page),
  };
}

export async function syncMaterials() {
  console.log("[sync] fetching materials from Notion...");
  const pages = await queryAllPages(NOTION_DBS.materials);
  console.log(`[sync] found ${pages.length} materials`);

  const notionIds: string[] = [];

  for (const page of pages) {
    const row = parseMaterialPage(page);
    notionIds.push(row.notionId);

    await sql`
      INSERT INTO materials_cache (
        notion_id, title, form_primary, functions, connector_modes,
        context_tags, do_not_use, do_not_use_reason, shareability,
        min_qty_size, examples_notes, generation_notes,
        generation_prompts, source, notion_last_edited, synced_at
      ) VALUES (
        ${row.notionId}, ${row.title}, ${row.formPrimary},
        ${JSON.stringify(row.functions)}, ${JSON.stringify(row.connectorModes)},
        ${JSON.stringify(row.contextTags)}, ${row.doNotUse},
        ${row.doNotUseReason}, ${row.shareability}, ${row.minQtySize},
        ${row.examplesNotes}, ${row.generationNotes},
        ${JSON.stringify(row.generationPrompts)}, ${row.source},
        ${row.lastEdited}, NOW()
      )
      ON CONFLICT (notion_id) DO UPDATE SET
        title = EXCLUDED.title,
        form_primary = EXCLUDED.form_primary,
        functions = EXCLUDED.functions,
        connector_modes = EXCLUDED.connector_modes,
        context_tags = EXCLUDED.context_tags,
        do_not_use = EXCLUDED.do_not_use,
        do_not_use_reason = EXCLUDED.do_not_use_reason,
        shareability = EXCLUDED.shareability,
        min_qty_size = EXCLUDED.min_qty_size,
        examples_notes = EXCLUDED.examples_notes,
        generation_notes = EXCLUDED.generation_notes,
        generation_prompts = EXCLUDED.generation_prompts,
        source = EXCLUDED.source,
        notion_last_edited = EXCLUDED.notion_last_edited,
        synced_at = NOW()
    `;
  }

  if (notionIds.length > 0) {
    await sql.query(
      `DELETE FROM materials_cache WHERE notion_id != ALL($1::text[])`,
      [notionIds],
    );
  }

  console.log(`[sync] materials sync complete: ${pages.length} upserted`);
  return pages.length;
}
