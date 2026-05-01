/**
 * One-time script to generate play catalyst coaching prompts for vault activities.
 *
 * Reads all activities from the Postgres cache, generates three coaching
 * prompts per activity via Claude Haiku, and writes them back to Notion
 * as rich-text properties. The next daily sync picks them up naturally.
 *
 * Usage:
 *   cd apps/vertigo-vault
 *   npx tsx scripts/generate-catalysts.ts [--dry-run] [--only <slug>]
 *
 * Required env vars (pull from Vercel first):
 *   ANTHROPIC_API_KEY — Claude API key
 *   POSTGRES_URL      — Neon connection string
 *   NOTION_TOKEN      — Notion integration token
 *
 * Token economics: ~72 activities × ~900 tokens/activity = ~65K tokens ≈ $0.05 (Haiku)
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import { createPool } from "@vercel/postgres";

const RATE_LIMIT_DELAY_MS = 400;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Activity {
  notion_id: string;
  slug: string;
  name: string;
  type: string[];
  skills_developed: string[];
  body_html: string | null;
}

interface CatalystPrompts {
  warmup: string;
  connection: string;
  transfer: string;
}

function buildPrompt(activity: Activity): string {
  const type = (activity.type ?? []).join(", ") || "creative activity";
  const skills = (activity.skills_developed ?? []).join(", ") || "general skills";

  return `You are a playful creativity coach. For the activity "${activity.name}" (type: ${type}, skills: ${skills}), write three short coaching prompts (50-80 words each):

1. WARM UP: Help adults shed inhibitions and get into a playful mindset before starting this specific activity. Be specific to what the activity involves.
2. CONNECT: How to be present during this activity and make meaningful connections with others. Reference specific moments or dynamics this activity creates.
3. TAKE IT HOME: How insights from this play experience transfer to work and home life. Connect the skills developed to real-world situations.

Be warm, encouraging, specific to this activity. Use "you" voice. No bullet lists — flowing prose. No headers or labels in the output. Use all lowercase (no capital letters except acronyms like PRME or AI).

Return ONLY a JSON object with keys "warmup", "connection", "transfer". Each value is a string of 50-80 words.`;
}

async function generateCatalysts(
  anthropic: Anthropic,
  activity: Activity,
): Promise<CatalystPrompts> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(activity) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  // Extract JSON from response (handle possible markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in response for "${activity.name}"`);

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    warmup: parsed.warmup,
    connection: parsed.connection,
    transfer: parsed.transfer,
  };
}

async function writeToNotion(
  notion: Client,
  notionId: string,
  catalysts: CatalystPrompts,
) {
  await notion.pages.update({
    page_id: notionId,
    properties: {
      "warm-up prompt": {
        rich_text: [{ text: { content: catalysts.warmup } }],
      },
      "connection prompt": {
        rich_text: [{ text: { content: catalysts.connection } }],
      },
      "transfer prompt": {
        rich_text: [{ text: { content: catalysts.transfer } }],
      },
    },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const onlyIdx = args.indexOf("--only");
  const onlySlug = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  // Validate env
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required");
  if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL required");
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN required");

  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const anthropic = new Anthropic();
  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  // Fetch activities — only those missing catalyst content (unless --force)
  let query: string;
  if (onlySlug) {
    query = `
      SELECT notion_id, slug, name, type, skills_developed, body_html
      FROM vault_activities_cache
      WHERE slug = '${onlySlug}'
    `;
  } else if (force) {
    query = `
      SELECT notion_id, slug, name, type, skills_developed, body_html
      FROM vault_activities_cache
    `;
  } else {
    query = `
      SELECT notion_id, slug, name, type, skills_developed, body_html
      FROM vault_activities_cache
      WHERE warmup_prompt IS NULL
         OR connection_prompt IS NULL
         OR transfer_prompt IS NULL
    `;
  }

  const { rows } = await pool.query(query);
  console.log(`Found ${rows.length} activities to process${dryRun ? " (dry run)" : ""}`);

  let success = 0;
  let errors = 0;

  for (const row of rows as Activity[]) {
    try {
      // Parse JSON array columns
      if (typeof row.type === "string") row.type = JSON.parse(row.type);
      if (typeof row.skills_developed === "string") row.skills_developed = JSON.parse(row.skills_developed);

      console.log(`  → ${row.name} (${row.slug})`);
      const catalysts = await generateCatalysts(anthropic, row);

      if (dryRun) {
        console.log(`    warmup: ${catalysts.warmup.substring(0, 60)}…`);
        console.log(`    connection: ${catalysts.connection.substring(0, 60)}…`);
        console.log(`    transfer: ${catalysts.transfer.substring(0, 60)}…`);
      } else {
        await writeToNotion(notion, row.notion_id, catalysts);
        console.log(`    ✓ written to Notion`);
      }

      success++;
      await delay(RATE_LIMIT_DELAY_MS);
    } catch (err: any) {
      console.error(`    ✗ error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${errors} failed`);
  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

main();
