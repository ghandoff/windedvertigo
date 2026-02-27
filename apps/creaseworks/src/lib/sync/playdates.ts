import { sql } from "@/lib/db";
import { NOTION_DBS } from "@/lib/notion";
import { makeSlug } from "@/lib/slugify";
import { syncCacheTable } from "./sync-cache-table";
import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractMultiSelect,
  extractCheckbox,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
  type NotionPage,
} from "./extract";

interface PlaydateRow {
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
  ageRange: string | null;
  tinkeringTier: string | null;
}

function parsePlaydatePage(page: NotionPage): PlaydateRow {
  const props = page.properties;
  const frictionStr = extractSelect(props, "friction dial");
  const frictionDial = frictionStr ? parseInt(frictionStr, 10) : null;

  return {
    notionId: extractPageId(page),
    title: extractTitle(props, "playdate"),
    headline: extractRichText(props, "headline"),
    releaseChannel: extractSelect(props, "release channel"),
    ipTier: extractSelect(props, "ip tier"),
    status: extractSelect(props, "status"),
    primaryFunction: extractSelect(props, "primary function"),
    arcEmphasis: extractMultiSelect(props, "arc emphasis"),
    contextTags: extractMultiSelect(props, "context tags"),
    frictionDial: Number.isNaN(frictionDial) ? null : frictionDial,
    startIn120s: extractCheckbox(props, "start in 2 minutes"),
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
    ageRange: extractSelect(props, "age range"),
    tinkeringTier: extractSelect(props, "tinkering tier"),
  };
}

export async function syncPlaydates() {
  return syncCacheTable<PlaydateRow>({
    databaseId: NOTION_DBS.playdates,
    label: "playdates",
    parsePage: parsePlaydatePage,
    upsertRow: async (row) => {
      // Upsert — generate slug only on insert (COALESCE keeps existing slug)
      await sql`
        INSERT INTO playdates_cache (
          notion_id, title, headline, release_channel, ip_tier, status,
          primary_function, arc_emphasis, context_tags, friction_dial,
          start_in_120s, required_forms, slots_optional, slots_notes,
          rails_sentence, find, fold, unfold, find_again_mode,
          find_again_prompt, substitutions_notes,
          design_rationale, developmental_notes, author_notes,
          notion_last_edited, synced_at, slug, age_range, tinkering_tier
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
          ${row.lastEdited}, NOW(), ${makeSlug(row.title)}, ${row.ageRange},
          ${row.tinkeringTier}
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
          synced_at = NOW(),
          age_range = EXCLUDED.age_range,
          tinkering_tier = EXCLUDED.tinkering_tier
      `;
    },
    cleanupStale: async (activeNotionIds) => {
      // Soft-delete playdates removed from Notion (other tables reference playdates_cache)
      await sql.query(
        `UPDATE playdates_cache
         SET status = 'archived', synced_at = NOW()
         WHERE notion_id != ALL($1::text[])`,
        [activeNotionIds],
      );
    },
    resolveRelations: async (pages) => {
      // Resolve material relations
      for (const page of pages) {
        const row = parsePlaydatePage(page);
        const playdateResult = await sql`
          SELECT id FROM playdates_cache WHERE notion_id = ${row.notionId}
        `;
        if (playdateResult.rows.length === 0) continue;
        const playdateId = playdateResult.rows[0].id;

        // Clear existing relations for this playdate
        await sql`DELETE FROM playdate_materials WHERE playdate_id = ${playdateId}`;

        // Insert new relations
        for (const materialNotionId of row.materialRelationIds) {
          const materialResult = await sql`
            SELECT id FROM materials_cache WHERE notion_id = ${materialNotionId}
          `;
          if (materialResult.rows.length > 0) {
            await sql`
              INSERT INTO playdate_materials (playdate_id, material_id)
              VALUES (${playdateId}, ${materialResult.rows[0].id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    },
  });
}
