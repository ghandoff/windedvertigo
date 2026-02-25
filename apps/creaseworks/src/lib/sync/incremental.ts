/**
 * Incremental sync — process a single Notion page change.
 *
 * Used by the webhook handler to sync individual pages as they change,
 * rather than the full daily cron sync.
 *
 * Supports: playdates, materials, packs, runs.
 * Falls back gracefully — if the page type is unknown, logs and skips.
 *
 * MVP 7 — Notion webhook listener.
 */

import { sql } from "@/lib/db";
import { NOTION_DBS, delay, RATE_LIMIT_DELAY_MS } from "@/lib/notion";
import { Client } from "@notionhq/client";

/* ------------------------------------------------------------------ */
/*  re-use extract helpers                                             */
/* ------------------------------------------------------------------ */

import {
  extractTitle,
  extractRichText,
  extractSelect,
  extractMultiSelect,
  extractCheckbox,
  extractDate,
  extractNumber,
  extractRelationIds,
  extractLastEdited,
  extractPageId,
  assertPropertiesExist,
} from "./extract";

/** Notion property names that must exist on every reflections page. */
const REQUIRED_RUN_PROPS = [
  "reflection",       // title
  "context of use",   // select (was "reflection type")
  "date",
  "playdate",
  "context tags",
  "trace evidence captured",
];

/* ------------------------------------------------------------------ */
/*  database ID → type mapping                                         */
/* ------------------------------------------------------------------ */

type ContentType = "playdates" | "materials" | "packs" | "runs" | "collections";

function resolveContentType(databaseId: string): ContentType | null {
  // Normalise: Notion sometimes sends IDs with dashes, sometimes without
  const normalised = databaseId.replace(/-/g, "");

  const map: Record<string, ContentType> = {
    [NOTION_DBS.playdates.replace(/-/g, "")]: "playdates",
    [NOTION_DBS.materials.replace(/-/g, "")]: "materials",
    [NOTION_DBS.packs.replace(/-/g, "")]: "packs",
    [NOTION_DBS.reflections.replace(/-/g, "")]: "runs",
    ...(NOTION_DBS.collections ? { [NOTION_DBS.collections.replace(/-/g, "")]: "collections" as ContentType } : {}),
  };

  return map[normalised] ?? null;
}

/* ------------------------------------------------------------------ */
/*  sync a single page by fetching it fresh from Notion                */
/* ------------------------------------------------------------------ */

export async function syncSinglePage(
  notionClient: Client,
  pageId: string,
  databaseId: string,
): Promise<{ synced: boolean; type: string | null }> {
  const contentType = resolveContentType(databaseId);
  if (!contentType) {
    console.log(`[webhook-sync] unknown database ${databaseId}, skipping`);
    return { synced: false, type: null };
  }

  console.log(`[webhook-sync] syncing ${contentType} page ${pageId}`);

  await delay(RATE_LIMIT_DELAY_MS);
  const page = await notionClient.pages.retrieve({ page_id: pageId }) as any;

  switch (contentType) {
    case "materials":
      await upsertMaterial(page);
      break;
    case "playdates":
      await upsertPlaydate(page);
      break;
    case "packs":
      await upsertPack(page);
      break;
    case "runs":
      await upsertRun(page);
      break;
    case "collections":
      await upsertCollection(page);
      break;
  }

  console.log(`[webhook-sync] ${contentType} page ${pageId} synced`);
  return { synced: true, type: contentType };
}

/* ------------------------------------------------------------------ */
/*  handle page deletion / archival                                    */
/* ------------------------------------------------------------------ */

export async function handlePageDeletion(
  pageId: string,
  databaseId: string,
): Promise<{ deleted: boolean; type: string | null }> {
  const contentType = resolveContentType(databaseId);
  if (!contentType) return { deleted: false, type: null };

  const normalised = pageId.replace(/-/g, "");

  // Audit-2 M3: use explicit switch with literal SQL to avoid dynamic table
  // name interpolation (even though tableMap values were hardcoded, this
  // pattern is safer against future edits introducing user input).
  switch (contentType) {
    case "materials":
      await sql.query(`DELETE FROM materials_cache WHERE notion_id = $1`, [normalised]);
      break;
    case "playdates":
      await sql.query(`DELETE FROM playdates_cache WHERE notion_id = $1`, [normalised]);
      break;
    case "packs":
      await sql.query(`DELETE FROM packs_cache WHERE notion_id = $1`, [normalised]);
      break;
    case "runs":
      await sql.query(`DELETE FROM runs_cache WHERE notion_id = $1`, [normalised]);
      break;
    case "collections":
      await sql.query(`DELETE FROM collections WHERE notion_id = $1`, [normalised]);
      break;
  }
  console.log(`[webhook-sync] deleted ${contentType} ${pageId}`);
  return { deleted: true, type: contentType };
}

/* ------------------------------------------------------------------ */
/*  per-type upsert helpers (mirrors sync/*.ts but for single pages)   */
/* ------------------------------------------------------------------ */

async function upsertMaterial(page: any) {
  const props = page.properties;
  const notionId = extractPageId(page);
  const title = extractTitle(props, "material");
  const lastEdited = extractLastEdited(page);

  // Extract all material fields — must match materials_cache schema
  const formPrimary = extractSelect(props, "form (primary)");
  const functions = extractMultiSelect(props, "functions");
  const connectorModes = extractMultiSelect(props, "connector modes");
  const contextTags = extractMultiSelect(props, "context tags");
  const doNotUse = extractCheckbox(props, "do not use");
  const doNotUseReason = extractSelect(props, "do not use reason");
  const shareability = extractRichText(props, "shareability");
  const minQtySize = extractRichText(props, "min qty / size");
  const examplesNotes = extractRichText(props, "examples / notes");
  const generationNotes = extractRichText(props, "generation notes");
  const generationPrompts = extractMultiSelect(props, "generation prompts");
  const source = extractSelect(props, "source");

  await sql`
    INSERT INTO materials_cache (
      notion_id, title, form_primary, functions, connector_modes,
      context_tags, do_not_use, do_not_use_reason, shareability,
      min_qty_size, examples_notes, generation_notes,
      generation_prompts, source, notion_last_edited, synced_at
    ) VALUES (
      ${notionId}, ${title}, ${formPrimary},
      ${JSON.stringify(functions)}, ${JSON.stringify(connectorModes)},
      ${JSON.stringify(contextTags)}, ${doNotUse},
      ${doNotUseReason}, ${shareability}, ${minQtySize},
      ${examplesNotes}, ${generationNotes},
      ${JSON.stringify(generationPrompts)}, ${source},
      ${lastEdited}, NOW()
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

async function upsertPlaydate(page: any) {
  const props = page.properties;
  const notionId = extractPageId(page);
  const title = extractTitle(props, "playdate");
  const headline = extractRichText(props, "headline");
  const releaseChannel = extractSelect(props, "release channel");
  const ipTier = extractSelect(props, "ip tier");
  const status = extractSelect(props, "status");
  const primaryFunction = extractSelect(props, "primary function");
  const arcEmphasis = extractMultiSelect(props, "arc emphasis");
  const contextTags = extractMultiSelect(props, "context tags");
  const frictionStr = extractSelect(props, "friction dial");
  const frictionDial = frictionStr ? parseInt(frictionStr, 10) : null;
  const startIn120s = extractCheckbox(props, "start in 2 minutes");
  const requiredForms = extractMultiSelect(props, "required forms");
  const slotsOptional = extractMultiSelect(props, "slots (optional)");
  const slotsNotes = extractRichText(props, "slots notes (optional)");
  const railsSentence = extractRichText(props, "rails sentence");
  const find = extractRichText(props, "find");
  const fold = extractRichText(props, "fold");
  const unfold = extractRichText(props, "unfold");
  const findAgainMode = extractSelect(props, "find again mode");
  const findAgainPrompt = extractRichText(props, "find again prompt");
  const substitutionsNotes = extractRichText(props, "substitutions notes");
  const lastEdited = extractLastEdited(page);

  // Generate slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await sql`
    INSERT INTO playdates_cache (
      notion_id, title, headline, release_channel, ip_tier, status,
      primary_function, arc_emphasis, context_tags, friction_dial,
      start_in_120s, required_forms, slots_optional, slots_notes,
      rails_sentence, find, fold, unfold, find_again_mode,
      find_again_prompt, substitutions_notes, notion_last_edited,
      synced_at, slug
    ) VALUES (
      ${notionId}, ${title}, ${headline},
      ${releaseChannel}, ${ipTier}, ${status},
      ${primaryFunction}, ${JSON.stringify(arcEmphasis)},
      ${JSON.stringify(contextTags)}, ${Number.isNaN(frictionDial) ? null : frictionDial},
      ${startIn120s}, ${JSON.stringify(requiredForms)},
      ${JSON.stringify(slotsOptional)}, ${slotsNotes},
      ${railsSentence}, ${find}, ${fold}, ${unfold},
      ${findAgainMode}, ${findAgainPrompt},
      ${substitutionsNotes}, ${lastEdited},
      NOW(), ${slug}
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
      notion_last_edited = EXCLUDED.notion_last_edited,
      synced_at = NOW()
  `;

  // Resolve material relations inside a transaction to prevent orphaned links
  const materialRelationIds = extractRelationIds(props, "materials");
  const playdateResult = await sql`
    SELECT id FROM playdates_cache WHERE notion_id = ${notionId}
  `;
  if (playdateResult.rows.length > 0) {
    const playdateId = playdateResult.rows[0].id;
    await sql.query("BEGIN");
    try {
      await sql`DELETE FROM playdate_materials WHERE playdate_id = ${playdateId}`;
      for (const materialNotionId of materialRelationIds) {
        const matResult = await sql`
          SELECT id FROM materials_cache WHERE notion_id = ${materialNotionId}
        `;
        if (matResult.rows.length > 0) {
          await sql`
            INSERT INTO playdate_materials (playdate_id, material_id)
            VALUES (${playdateId}, ${matResult.rows[0].id})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      await sql.query("COMMIT");
    } catch (err) {
      await sql.query("ROLLBACK");
      throw err;
    }
  }
}

async function upsertPack(page: any) {
  const props = page.properties;
  const notionId = extractPageId(page);
  const title = extractTitle(props, "pack");
  const description = extractRichText(props, "description");
  const status = extractSelect(props, "status");
  const lastEdited = extractLastEdited(page);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await sql`
    INSERT INTO packs_cache (
      notion_id, title, slug, description, status,
      notion_last_edited, synced_at
    ) VALUES (
      ${notionId}, ${title}, ${slug}, ${description}, ${status},
      ${lastEdited}, NOW()
    )
    ON CONFLICT (notion_id) DO UPDATE SET
      title = EXCLUDED.title,
      slug = EXCLUDED.slug,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      notion_last_edited = EXCLUDED.notion_last_edited,
      synced_at = NOW()
  `;

  // Resolve playdate relations inside a transaction to prevent orphaned links
  const playdateRelationIds = extractRelationIds(props, "playdates included");
  const packResult = await sql`
    SELECT id FROM packs_cache WHERE notion_id = ${notionId}
  `;
  if (packResult.rows.length > 0) {
    const packId = packResult.rows[0].id;
    await sql.query("BEGIN");
    try {
      await sql`DELETE FROM pack_playdates WHERE pack_id = ${packId}`;
      for (const playdateNotionId of playdateRelationIds) {
        const playdateMatchResult = await sql`
          SELECT id FROM playdates_cache WHERE notion_id = ${playdateNotionId}
        `;
        if (playdateMatchResult.rows.length > 0) {
          await sql`
            INSERT INTO pack_playdates (pack_id, playdate_id)
            VALUES (${packId}, ${playdateMatchResult.rows[0].id})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      await sql.query("COMMIT");
    } catch (err) {
      await sql.query("ROLLBACK");
      throw err;
    }
  }
}

async function upsertRun(page: any) {
  const props = page.properties;
  const notionId = extractPageId(page);
  assertPropertiesExist(props, REQUIRED_RUN_PROPS, notionId);
  const title = extractTitle(props, "reflection");
  const playdateIds = extractRelationIds(props, "playdate");
  const playdateNotionId = playdateIds.length > 0 ? playdateIds[0] : null;
  const runType = extractSelect(props, "context of use");
  const runDate = extractDate(props, "date");
  const contextTags = extractMultiSelect(props, "context tags");
  const traceEvidence = extractMultiSelect(props, "trace evidence captured");
  const whatChanged = extractRichText(props, "what changed");
  const nextIteration = extractRichText(props, "next iteration");
  const lastEdited = extractLastEdited(page);
  const materialRelationIds = extractRelationIds(props, "materials used (actual)");

  // Audit-2 H3: explicitly set source='notion' for parity with batch sync
  await sql`
    INSERT INTO runs_cache (
      notion_id, title, playdate_notion_id, run_type, run_date,
      context_tags, trace_evidence, what_changed, next_iteration,
      notion_last_edited, synced_at, source
    ) VALUES (
      ${notionId}, ${title}, ${playdateNotionId},
      ${runType}, ${runDate},
      ${JSON.stringify(contextTags)},
      ${JSON.stringify(traceEvidence)},
      ${whatChanged}, ${nextIteration},
      ${lastEdited}, NOW(), 'notion'
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

  // Resolve material relations inside a transaction to prevent orphaned links
  const runResult = await sql`
    SELECT id FROM runs_cache WHERE notion_id = ${notionId}
  `;
  if (runResult.rows.length > 0) {
    const runId = runResult.rows[0].id;
    await sql.query("BEGIN");
    try {
      await sql`DELETE FROM run_materials WHERE run_id = ${runId}`;
      for (const materialNotionId of materialRelationIds) {
        const matResult = await sql`
          SELECT id FROM materials_cache WHERE notion_id = ${materialNotionId}
        `;
        if (matResult.rows.length > 0) {
          await sql`
            INSERT INTO run_materials (run_id, material_id)
            VALUES (${runId}, ${matResult.rows[0].id})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      await sql.query("COMMIT");
    } catch (err) {
      await sql.query("ROLLBACK");
      throw err;
    }
  }
}

async function upsertCollection(page: any) {
  const props = page.properties;
  const notionId = extractPageId(page);
  const title = extractTitle(props, "collection");
  const description = extractRichText(props, "description");
  const iconEmoji = extractRichText(props, "icon");
  const sortOrder = extractNumber(props, "sort order") ?? 0;
  const status = extractSelect(props, "status") || "draft";
  const lastEdited = extractLastEdited(page);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await sql`
    INSERT INTO collections (
      notion_id, title, description, icon_emoji, sort_order, status,
      notion_last_edited, synced_at, slug
    ) VALUES (
      ${notionId}, ${title}, ${description},
      ${iconEmoji}, ${sortOrder}, ${status},
      ${lastEdited}, NOW(), ${slug}
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

  // Resolve playdate relations inside a transaction
  const playdateRelationIds = extractRelationIds(props, "playdates");
  const collResult = await sql`
    SELECT id FROM collections WHERE notion_id = ${notionId}
  `;
  if (collResult.rows.length > 0) {
    const collectionId = collResult.rows[0].id;
    await sql.query("BEGIN");
    try {
      await sql`DELETE FROM collection_playdates WHERE collection_id = ${collectionId}`;
      let displayOrder = 0;
      for (const playdateNotionId of playdateRelationIds) {
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
      await sql.query("COMMIT");
    } catch (err) {
      await sql.query("ROLLBACK");
      throw err;
    }
  }
}
