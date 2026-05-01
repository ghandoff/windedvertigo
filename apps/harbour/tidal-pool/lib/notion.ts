/**
 * tidal.pool — Notion integration
 *
 * Fetches elements and scenarios from Notion databases.
 * Uses direct queries with ISR revalidation (no sync pipeline).
 */

import { Client } from "@notionhq/client";
import type { PaletteItem, Scenario, PoolElement, Connection, ElementCategory } from "./types";

let _notion: Client | null = null;

function getNotion(): Client {
  if (!_notion) {
    if (!process.env.NOTION_TOKEN) {
      throw new Error("NOTION_TOKEN environment variable is required");
    }
    _notion = new Client({ auth: process.env.NOTION_TOKEN });
  }
  return _notion;
}

const ELEMENTS_DB = process.env.NOTION_DB_TIDAL_ELEMENTS ?? "";
const SCENARIOS_DB = process.env.NOTION_DB_TIDAL_SCENARIOS ?? "";

// ── Property extractors ────────────────────────────────────

function textProp(props: Record<string, unknown>, key: string): string {
  const p = props[key] as { rich_text?: { plain_text: string }[] } | undefined;
  return p?.rich_text?.map((t) => t.plain_text).join("") ?? "";
}

function titleProp(props: Record<string, unknown>, key: string): string {
  const p = props[key] as { title?: { plain_text: string }[] } | undefined;
  return p?.title?.map((t) => t.plain_text).join("") ?? "";
}

function selectProp(props: Record<string, unknown>, key: string): string {
  const p = props[key] as { select?: { name: string } | null } | undefined;
  return p?.select?.name ?? "";
}

function multiSelectProp(props: Record<string, unknown>, key: string): string[] {
  const p = props[key] as { multi_select?: { name: string }[] } | undefined;
  return p?.multi_select?.map((o) => o.name) ?? [];
}

function numberProp(props: Record<string, unknown>, key: string): number {
  const p = props[key] as { number?: number | null } | undefined;
  return p?.number ?? 0;
}

// ── Fetch elements ─────────────────────────────────────────

export async function fetchElements(): Promise<PaletteItem[]> {
  if (!ELEMENTS_DB) return [];

  const notion = getNotion();
  const response = await notion.databases.query({
    database_id: ELEMENTS_DB,
    filter: { property: "Status", select: { equals: "live" } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });

  return response.results.map((page) => {
    const props = (page as { properties: Record<string, unknown> }).properties;
    return {
      slug: textProp(props, "Slug"),
      label: titleProp(props, "Name"),
      icon: textProp(props, "Icon"),
      category: (selectProp(props, "Category") || "natural") as ElementCategory,
      defaultValue: numberProp(props, "Default Value"),
      color: textProp(props, "Color"),
      description: textProp(props, "Description"),
    };
  });
}

// ── Fetch scenarios ────────────────────────────────────────

export interface NotionScenario {
  slug: string;
  name: string;
  description: string;
  difficulty: "explore" | "challenge" | "complex";
  challengePrompt: string;
  skillSlugs: string[];
  presetConnections: string; // raw JSON string from Notion
}

export async function fetchScenarios(): Promise<NotionScenario[]> {
  if (!SCENARIOS_DB) return [];

  const notion = getNotion();
  const response = await notion.databases.query({
    database_id: SCENARIOS_DB,
    filter: { property: "Status", select: { equals: "live" } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });

  return response.results.map((page) => {
    const props = (page as { properties: Record<string, unknown> }).properties;
    return {
      slug: textProp(props, "Slug"),
      name: titleProp(props, "Name"),
      description: textProp(props, "Description"),
      difficulty: (selectProp(props, "Difficulty") || "explore") as NotionScenario["difficulty"],
      challengePrompt: textProp(props, "Challenge Prompt"),
      skillSlugs: multiSelectProp(props, "Skills"),
      presetConnections: textProp(props, "Preset Connections"),
    };
  });
}

export async function fetchScenarioBySlug(slug: string): Promise<NotionScenario | null> {
  if (!SCENARIOS_DB) return null;

  const notion = getNotion();
  const response = await notion.databases.query({
    database_id: SCENARIOS_DB,
    filter: {
      and: [
        { property: "Slug", rich_text: { equals: slug } },
        { property: "Status", select: { equals: "live" } },
      ],
    },
    page_size: 1,
  });

  if (response.results.length === 0) return null;

  const props = (response.results[0] as { properties: Record<string, unknown> }).properties;
  return {
    slug: textProp(props, "Slug"),
    name: titleProp(props, "Name"),
    description: textProp(props, "Description"),
    difficulty: (selectProp(props, "Difficulty") || "explore") as NotionScenario["difficulty"],
    challengePrompt: textProp(props, "Challenge Prompt"),
    skillSlugs: multiSelectProp(props, "Skills"),
    presetConnections: textProp(props, "Preset Connections"),
  };
}

// ── Hydrate scenario into pool-ready data ──────────────────

/**
 * Converts a Notion scenario + elements palette into a full
 * Scenario object with positioned elements and connections.
 */
export function hydrateScenario(
  scenario: NotionScenario,
  palette: PaletteItem[],
): Scenario {
  // Parse preset connections JSON (if any)
  let presetConnections: {
    from: string;
    to: string;
    type: string;
    strength?: number;
  }[] = [];
  if (scenario.presetConnections) {
    try {
      presetConnections = JSON.parse(scenario.presetConnections);
    } catch {
      // Invalid JSON — skip connections
    }
  }

  // Find palette items that are referenced in preset connections
  const referencedSlugs = new Set<string>();
  for (const c of presetConnections) {
    referencedSlugs.add(c.from);
    referencedSlugs.add(c.to);
  }

  // Build elements from referenced palette items, positioned in a circle
  const paletteMap = new Map(palette.map((p) => [p.slug, p]));
  const slugs = [...referencedSlugs].filter((s) => paletteMap.has(s));
  const elements: PoolElement[] = slugs.map((slug, i) => {
    const item = paletteMap.get(slug)!;
    const angle = (2 * Math.PI * i) / slugs.length - Math.PI / 2;
    const cx = 400;
    const cy = 300;
    const radius = Math.min(slugs.length * 30, 200);
    return {
      id: `scenario-${slug}`,
      slug: item.slug,
      label: item.label,
      icon: item.icon,
      category: item.category,
      value: item.defaultValue,
      minValue: 0,
      maxValue: 100,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      color: item.color,
    };
  });

  // Build connections
  const connections: Connection[] = presetConnections
    .filter((c) => paletteMap.has(c.from) && paletteMap.has(c.to))
    .map((c, i) => ({
      id: `scenario-conn-${i}`,
      from: `scenario-${c.from}`,
      to: `scenario-${c.to}`,
      type: (c.type || "amplifying") as Connection["type"],
      strength: c.strength ?? 0.5,
      delay: 0,
      threshold: 0,
    }));

  return {
    slug: scenario.slug,
    name: scenario.name,
    description: scenario.description,
    difficulty: scenario.difficulty,
    challengePrompt: scenario.challengePrompt,
    skillSlugs: scenario.skillSlugs,
    elements,
    connections,
  };
}
