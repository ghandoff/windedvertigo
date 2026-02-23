import { sql } from "@/lib/db";
import { queryAllPages, NOTION_DBS } from "@/lib/notion";
import { makeSlug } from "@/lib/slugify";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractMultiSelect,
  extractCheckbox,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
} from "./extract";

interface PatternRow {
  notionId: string;
  title: string;
  headline: string | null;
  releaseChannel: string | null;
  ipTier: string | null;
  status: string | null;
  primaryFunction: string | null;
  arcEmphasis: string[];
  contextTags: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  requiredForms: string[];
  slotsOptional: string[];
  slotsNotes: string | null;
  railsSentence: string | null;
  find: string | null;
  fold: string | null;
  unfold: string | null;
  findAgainMode: string | null;
  findAgainPrompt: string | null;
  substitutionsNotes: string | null;
  designRationale: string | null;
  developmentalNotes: string | null;
  authorNotes: string | null;
  lastEdited: string;
  materialRelationIds: string[];
}

function parsePatternPage(page: any): PatternRow {
  const props = page.properties;
  const frictionStr = extractSelect(props, "friction dial");
  const frictionDial = frictionStr ? parseInt(frictionStr, 10) : null;

  return {
    notionId: extractPageId(page),
    title: extractTitle(props, "pattern"),
    headline: extractRichText(props, "headline"),
    releaseChannel: extractSelect(props, "release channel"),
    ipTier: extractSelect(props, "ip tier"),
    status: extractSelect(props, "status"),
    primaryFunction: extractSelect(props, "primary function"),
    arcEmphasis: extractMultiSelect(props, "arc emphasis"),
    contextTags: extractMultiSelect(props, "context tags"),
    frictionDial: Number.isNaN(frictionDial) ? null : frictionDial,
    startIn120s: extractCheckbox(props, "start in 120 seconds"),
    requiredForms: extractMultiSelect(props, "required forms"),
    slotsOptional: extractMultiSelect(props, "slots (optional)"),
    slotsNotes: extractRichText(props, "slots notes (optional)"),
    railsSentence: extractRichText(props, "rails sentence"),
    find: extractRichText(props, "find"),
    fold: extractRichText(props, "fold"),
    unfold: extractRichText(props, "unfold"),
    findAgainMode: extractSelect(props, "find again mode"),
    findAgainPrompt: extractRichText(props, "find again prompt"),
    substitutionsNotes: extractRichText(props, "substitutions notes"),
    designRationale: extractRichText(props, "design rationale"),
    developmentalNotes: extractRichText(props, "developmental notes"),
    authorNotes: extractRichText(props, "author notes"),
    lastEdited: extractLastEdited(page),
    materialRelationIds: extractRelationIds(props, "materials"),
  };
}

export async function syncPatterns() {
  console.log("[sync] fetching patterns from Notion...");
  const pages = await queryAllPages(NOTION_DBS.patterns);
  console.log(`[sync] found ${pages.length} patterns`);

  const notionIds: string[] = [];

  for (const page of pages) {
    const row = parsePatternPage(page);
    notionIds.push(row.notionId);

    // Upsert — generate slug only on insert (COALESCE keeps existing slug)
    await sql`
      INSERT INTO patterns_cache (
        notion_id, title, headline, release_channel, ip_tier, status,
        primary_function, arc_emphasis, context_tags, friction_dial,
        start_in_120s, required_forms, slots_optional, slots_notes,
        rails_sentence, find, fold, unfold, find_again_mode,
        find_again_prompt, substitutions_notes,
        design_rationale, developmental_notes, author_notes,
        notion_last_edited, synced_at, slug
      ) VALUES (
        ${row.notionId}, ${row.title}, ${row.headline},
        ${row.releaseChannel}, ${row.ipTier}, ${row.status},
        ${row.primaryFunction}, ${JSON.stringify(row.arcEmphasis)},
        ${JSON.stringify(row.contextTags)}, ${row.frictionDial},
        ${row.startIn120s}, ${JSON.stringify(row.requiredForms)},
        ${JSON.stringify(row.slotsOptional)}, ${row.slotsNotes},
        ${row.railsSentence}, ${row.find}, ${row.fold}, ${row.unfold},
        ${row.findAgainMode}, ${row.findAgainPrompt},
        ${row.substitutionsNotes},
        ${row.designRationale}, ${row.developmentalNotes}, ${row.authorNotes},
        ${row.lastEdited}, NOW(), ${makeSlug(row.title)}
      )
      ON CONFLICT (notion_id) DO UPDATE SET
        title = EXCLUDED.title,
        headline = EXCLUDED.headline,
        release_channel = EXCLUDED.release_channel,
        ip_tier = EXCLUDED.ip_tier,
        status = EXCLUDED.status,
        primary_function = EXCLUDED.primary_function,
        arc_emphasis = EXCLUDED.arc_emphasis,
        context_tags = EXCLUDED.context_tags,
        friction_dial = EXCLUDED.friction_dial,
        start_in_120s = EXCLUDED.start_in_120s,
        required_forms = EXCLUDED.required_forms,
        slots_optional = EXCLUDED.slots_optional,
        slots_notes = EXCLUDED.slots_notes,
        rails_sentence = EXCLUDED.rails_sentence,
        find = EXCLUDED.find,
        fold = EXCLUDED.fold,
        unfold = EXCLUDED.unfold,
        find_again_mode = EXCLUDED.find_again_mode,
        find_again_prompt = EXCLUDED.find_again_prompt,
        substitutions_notes = EXCLUDED.substitutions_notes,
        design_rationale = EXCLUDED.design_rationale,
        developmental_notes = EXCLUDED.developmental_notes,
        author_notes = EXCLUDED.author_notes,
        notion_last_edited = EXCLUDED.notion_last_edited,
        synced_at = NOW()
    `;
  }

  // Remove patterns deleted from Notion
  if (notionIds.length > 0) {
    await sql.query(
      `DELETE FROM patterns_cache WHERE notion_id != ALL($1::text[])`,
      [notionIds],
    );
  }

  // Resolve material relations
  for (const page of pages) {
    const row = parsePatternPage(page);
    const patternResult = await sql`
      SELECT id FROM patterns_cache WHERE notion_id = ${row.notionId}
    `;
    if (patternResult.rows.length === 0) continue;
    const patternId = patternResult.rows[0].id;

    // Clear existing relations for this pattern
    await sql`DELETE FROM pattern_materials WHERE pattern_id = ${patternId}`;

    // Insert new relations
    for (const materialNotionId of row.materialRelationIds) {
      const materialResult = await sql`
        SELECT id FROM materials_cache WHERE notion_id = ${materialNotionId}
      `;
      if (materialResult.rows.length > 0) {
        await sql`
          INSERT INTO pattern_materials (pattern_id, material_id)
          VALUES (${patternId}, ${materialResult.rows[0].id})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }

  console.log(`[sync] patterns sync complete: ${pages.length} upserted`);
  return pages.length;
}
