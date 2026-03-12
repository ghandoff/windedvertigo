import { sql } from "@/lib/db";
import { notion, NOTION_DBS } from "@/lib/notion";
import { makeSlug } from "@/lib/slugify";
import { syncCacheTable } from "./sync-cache-table";
import {
  extractTitle,
  extractRichText,
  extractRichTextHtml,
  extractSelect,
  extractMultiSelect,
  extractRelationIds,
  extractUrl,
  extractLastEdited,
  extractPageId,
  extractCover,
  type NotionPage,
} from "./extract";
import { syncImageToR2, imageUrl } from "./sync-image";
import { fetchPageBodyHtml } from "./blocks";

interface VaultActivityRow {
  notionId: string;
  name: string;
  headline: string | null;
  headlineHtml: string | null;
  duration: string | null;
  format: string[];
  type: string[];
  skillsDeveloped: string[];
  tags: string[];
  tier: string | null;
  ageRange: string | null;
  groupSize: string | null;
  facilitatorNotes: string | null;
  facilitatorNotesHtml: string | null;
  materialsNeeded: string[];
  videoUrl: string | null;
  coverSourceUrl: string | null;
  lastEdited: string;
  relatedActivityIds: string[];
}

function parseVaultActivityPage(page: NotionPage): VaultActivityRow {
  const props = page.properties;
  return {
    notionId: extractPageId(page),
    name: extractTitle(props, "name"),
    headline: extractRichText(props, "headline"),
    headlineHtml: extractRichTextHtml(props, "headline"),
    duration: extractSelect(props, "duration"),
    format: extractMultiSelect(props, "format"),
    type: extractMultiSelect(props, "type"),
    skillsDeveloped: extractMultiSelect(props, "skills developed"),
    tags: extractMultiSelect(props, "tags"),
    tier: extractSelect(props, "tier"),
    ageRange: extractSelect(props, "age range"),
    groupSize: extractSelect(props, "group size"),
    facilitatorNotes: extractRichText(props, "facilitator notes"),
    facilitatorNotesHtml: extractRichTextHtml(props, "facilitator notes"),
    materialsNeeded: extractMultiSelect(props, "materials needed"),
    videoUrl: extractUrl(props, "video url"),
    coverSourceUrl: extractCover(page)?.url ?? null,
    lastEdited: extractLastEdited(page),
    relatedActivityIds: extractRelationIds(props, "related activities"),
  };
}

export async function syncVaultActivities() {
  return syncCacheTable<VaultActivityRow>({
    databaseId: NOTION_DBS.vault,
    label: "vault activities",
    parsePage: parseVaultActivityPage,
    upsertRow: async (row) => {
      // Sync cover image to R2
      let coverR2Key: string | null = null;
      let coverUrl: string | null = null;
      if (row.coverSourceUrl) {
        coverR2Key = await syncImageToR2(row.coverSourceUrl, row.notionId, "cover");
        coverUrl = imageUrl(coverR2Key);
      }

      // Fetch page body content as HTML + markdown
      let bodyHtml: string | null = null;
      let contentMd: string | null = null;
      try {
        bodyHtml = await fetchPageBodyHtml(notion(), row.notionId);
        // Simple HTML → plain-ish markdown for the standalone vault
        // (the standalone app currently uses markdown from blocks)
        contentMd = bodyHtml
          ? bodyHtml
              .replace(/<h2[^>]*>/g, "## ")
              .replace(/<h3[^>]*>/g, "### ")
              .replace(/<\/h[23]>/g, "\n")
              .replace(/<li>/g, "- ")
              .replace(/<\/li>/g, "\n")
              .replace(/<[^>]+>/g, "")
              .trim()
          : null;
      } catch {
        // Non-blocking — body content is supplementary
      }

      await sql`
        INSERT INTO vault_activities_cache (
          notion_id, slug, name, headline, headline_html,
          duration, format, type, skills_developed, tags,
          tier, age_range, group_size,
          facilitator_notes, facilitator_notes_html,
          materials_needed, video_url,
          cover_r2_key, cover_url,
          body_html, content_md,
          notion_last_edited, synced_at
        ) VALUES (
          ${row.notionId}, ${makeSlug(row.name)}, ${row.name},
          ${row.headline}, ${row.headlineHtml},
          ${row.duration}, ${JSON.stringify(row.format)},
          ${JSON.stringify(row.type)}, ${JSON.stringify(row.skillsDeveloped)},
          ${JSON.stringify(row.tags)},
          ${row.tier ?? "prme"}, ${row.ageRange}, ${row.groupSize},
          ${row.facilitatorNotes}, ${row.facilitatorNotesHtml},
          ${JSON.stringify(row.materialsNeeded)}, ${row.videoUrl},
          ${coverR2Key}, ${coverUrl},
          ${bodyHtml}, ${contentMd},
          ${row.lastEdited}, NOW()
        )
        ON CONFLICT (notion_id) DO UPDATE SET
          name = EXCLUDED.name,
          headline = EXCLUDED.headline,
          headline_html = EXCLUDED.headline_html,
          duration = EXCLUDED.duration,
          format = EXCLUDED.format,
          type = EXCLUDED.type,
          skills_developed = EXCLUDED.skills_developed,
          tags = EXCLUDED.tags,
          tier = EXCLUDED.tier,
          age_range = EXCLUDED.age_range,
          group_size = EXCLUDED.group_size,
          facilitator_notes = EXCLUDED.facilitator_notes,
          facilitator_notes_html = EXCLUDED.facilitator_notes_html,
          materials_needed = EXCLUDED.materials_needed,
          video_url = EXCLUDED.video_url,
          cover_r2_key = EXCLUDED.cover_r2_key,
          cover_url = EXCLUDED.cover_url,
          body_html = EXCLUDED.body_html,
          content_md = EXCLUDED.content_md,
          notion_last_edited = EXCLUDED.notion_last_edited,
          synced_at = NOW()
      `;
    },
    cleanupStale: async (activeNotionIds) => {
      // Hard-delete stale vault activities (no other tables reference them yet)
      await sql.query(
        `DELETE FROM vault_activities_cache
         WHERE notion_id != ALL($1::text[])`,
        [activeNotionIds],
      );
    },
    resolveRelations: async (pages) => {
      // Resolve self-referencing "related activities" relation
      for (const page of pages) {
        const row = parseVaultActivityPage(page);
        const activityResult = await sql`
          SELECT id FROM vault_activities_cache WHERE notion_id = ${row.notionId}
        `;
        if (activityResult.rows.length === 0) continue;
        const activityId = activityResult.rows[0].id;

        // Clear existing relations for this activity
        await sql`DELETE FROM vault_related_activities WHERE vault_activity_id = ${activityId}`;

        // Insert new relations
        for (const relatedNotionId of row.relatedActivityIds) {
          const relatedResult = await sql`
            SELECT id FROM vault_activities_cache WHERE notion_id = ${relatedNotionId}
          `;
          if (relatedResult.rows.length > 0) {
            await sql`
              INSERT INTO vault_related_activities (vault_activity_id, related_activity_id)
              VALUES (${activityId}, ${relatedResult.rows[0].id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    },
  });
}
