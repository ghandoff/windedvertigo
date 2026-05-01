/**
 * Package builder data fetcher — port-side copy.
 *
 * Fetches quadrants, outcomes, and portfolio examples from Notion so the
 * port cron can render PDFs without calling back to the site.
 *
 * Extracted from site/lib/notion.ts. Uses the port's shared Notion client
 * and the Notion v5 dataSources API (2025-09-03).
 *
 * Required env vars: NOTION_TOKEN
 */

import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDataSourceParameters,
  QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";

// ── Notion client ─────────────────────────────────────────
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── Database IDs (site databases, not port) ───────────────
const SITE_DB = {
  portfolioAssets: "5e27b792adbb4a958779900fb59dd631",
  quadrants: "1c171d25825b418caf94805dc1568352",
  outcomes: "b8ff41d2d4ef41559e01c2d952a3a1da",
} as const;

// ── Data source cache ─────────────────────────────────────
const dataSourceCache = new Map<string, string>();

async function getDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) return cached;
  const db = await withRetry(
    () => notion.databases.retrieve({ database_id: databaseId }),
    `getDataSourceId:${databaseId}`,
  );
  if (!("data_sources" in db) || db.data_sources.length === 0) {
    throw new Error(`no data sources found for database ${databaseId}`);
  }
  const id = db.data_sources[0].id;
  dataSourceCache.set(databaseId, id);
  return id;
}

async function queryDataSource(
  databaseId: string,
  params: Omit<QueryDataSourceParameters, "data_source_id">,
): Promise<QueryDataSourceResponse> {
  const data_source_id = await getDataSourceId(databaseId);
  return notion.dataSources.query({ data_source_id, ...params });
}

// ── Retry helper ──────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.warn(
          `[package-builder] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms…`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(
    `${label} failed after ${maxAttempts} attempts: ${lastError?.message}`,
  );
}

// ── Property extractors ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Prop = any;

function getText(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "rich_text")
    return prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join("");
  return "";
}

function getTitle(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "title")
    return prop.title.map((t: { plain_text: string }) => t.plain_text).join("");
  return "";
}

function getSelect(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name ?? "";
  return "";
}

function getMultiSelect(prop: Prop): string[] {
  if (!prop) return [];
  if (prop.type === "multi_select")
    return prop.multi_select.map((s: { name: string }) => s.name);
  return [];
}

function getUrl(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "url") return prop.url ?? "";
  return "";
}

function getNumber(prop: Prop): number | null {
  if (!prop) return null;
  if (prop.type === "number") return prop.number;
  return null;
}

function getCheckbox(prop: Prop): boolean {
  if (!prop) return false;
  if (prop.type === "checkbox") return prop.checkbox;
  return false;
}

function getRelationIds(prop: Prop): string[] {
  if (!prop) return [];
  if (prop.type === "relation")
    return prop.relation.map((r: { id: string }) => r.id);
  return [];
}

function getIconValue(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "files" && prop.files?.length > 0) {
    const file = prop.files[0];
    if (file.type === "file") return file.file.url;
    if (file.type === "external") return file.external.url;
  }
  if (prop.type === "rich_text") return getText(prop);
  return "";
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Types ─────────────────────────────────────────────────

export interface PackExample {
  id: string;
  title: string;
  type: string;
  icon: string;
  url: string;
  detail: string;
  thumbnailUrl: string;
  tags: string[];
  quadrants: string[];
}

export interface PackData {
  title: string;
  promise: string;
  quadrantStory: string;
  story: string;
  crossover: string;
  outcomes: { title: string; detail: string }[];
  examples: PackExample[];
}

// ── Quadrant relation cache ───────────────────────────────

const quadrantRelCache: Record<string, string> = {};
const VALID_QUADRANT_KEYS = [
  "people-design",
  "people-research",
  "product-design",
  "product-research",
];

async function hydrateQuadrantRel(pageIds: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const id of pageIds) {
    if (quadrantRelCache[id] !== undefined) {
      if (quadrantRelCache[id]) results.push(quadrantRelCache[id]);
      continue;
    }
    try {
      const page = await withRetry(
        () => notion.pages.retrieve({ page_id: id }),
        `hydrateQuadrant:${id}`,
      );
      if (!("properties" in page)) continue;
      const key = getSelect(page.properties["Quadrant Key"]);
      if (key && VALID_QUADRANT_KEYS.includes(key)) {
        quadrantRelCache[id] = key;
        results.push(key);
      } else {
        quadrantRelCache[id] = "";
      }
    } catch {
      quadrantRelCache[id] = "";
    }
  }
  return results;
}

// ── Portfolio asset fetcher ───────────────────────────────

const ASSET_PROPS = {
  name: "asset",
  slug: "Slug",
  assetType: "Website Asset Type",
  quadrantRel: "Package Builder - Quadrants",
  url: "url",
  thumbnailUrl: "Thumbnail URL",
  description: "Description",
  tags: "Tags",
  featured: "Featured",
  showInPackageBuilder: "Show in Package Builder",
  showInPortfolio: "Show in Portfolio",
  icon: "Icon",
  order: "Order",
} as const;

async function fetchPortfolioAssets(): Promise<
  {
    id: string;
    name: string;
    slug: string;
    assetType: string;
    quadrants: string[];
    url: string;
    thumbnailUrl: string;
    description: string;
    tags: string[];
    showInPackageBuilder: boolean;
    icon: string;
    order: number | null;
  }[]
> {
  const p = ASSET_PROPS;
  const parentDbId = SITE_DB.portfolioAssets;
  const parentDashed = parentDbId.replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    "$1-$2-$3-$4-$5",
  );

  let allPages: PageObjectResponse[] = [];
  let startCursor: string | undefined;
  let round = 0;

  do {
    round++;
    const response = await withRetry(
      () =>
        notion.search({
          filter: { property: "object", value: "page" },
          page_size: 100,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        }),
      `searchPortfolioAssets:round${round}`,
    );

    for (const page of response.results) {
      if (!("properties" in page)) continue;
      const pid = (page as PageObjectResponse).parent;
      if (
        "database_id" in pid &&
        (pid.database_id === parentDbId || pid.database_id === parentDashed)
      ) {
        allPages.push(page as PageObjectResponse);
      }
    }

    startCursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (startCursor && round < 30);

  const assets = [];

  for (const page of allPages) {
    const props = page.properties;
    if (!props[p.name] || (props[p.name] as Prop).type !== "title") continue;

    const showInPB = getCheckbox(props[p.showInPackageBuilder]);
    const showInPortfolio = getCheckbox(props[p.showInPortfolio]);
    if (!showInPortfolio && !showInPB) continue;

    const quadrantRelIds = getRelationIds(props[p.quadrantRel]);
    const quadrantKeys = await hydrateQuadrantRel(quadrantRelIds);
    const assetName = getTitle(props[p.name]);

    // Use external cover (permanent) or property URL — skip expiring Notion file covers
    const externalCoverUrl =
      page.cover?.type === "external" ? page.cover.external.url : "";
    const propertyUrl = getUrl(props[p.thumbnailUrl]);
    const thumbnailUrl = externalCoverUrl || propertyUrl;

    assets.push({
      id: page.id,
      name: assetName,
      slug: getText(props[p.slug]) || toSlug(assetName),
      assetType: getSelect(props[p.assetType]),
      quadrants: quadrantKeys,
      url: getUrl(props[p.url]),
      thumbnailUrl,
      description: getText(props[p.description]),
      tags: getMultiSelect(props[p.tags]),
      showInPackageBuilder: showInPB,
      icon: getIconValue(props[p.icon]),
      order: getNumber(props[p.order]),
    });
  }

  assets.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  return assets;
}

// ── Package builder data fetcher ──────────────────────────

const QUADRANT_PROPS = {
  key: "Quadrant Key",
  title: "Title",
  promise: "Promise",
  quadrantStory: "Quadrant Story",
  story: "how we work",
  crossover: "crossover note",
} as const;

const OUTCOME_PROPS = {
  quadrant: "Quadrant",
  name: "Name",
  detail: "Detail",
  order: "Order",
} as const;

export async function fetchPackageBuilderData(): Promise<Record<string, PackData>> {
  const qp = QUADRANT_PROPS;
  const op = OUTCOME_PROPS;

  const [quadrantsRes, outcomesRes, portfolioAssets] = await Promise.all([
    withRetry(
      () => queryDataSource(SITE_DB.quadrants, {}),
      "fetchQuadrants",
    ),
    withRetry(
      () =>
        queryDataSource(SITE_DB.outcomes, {
          sorts: [{ property: op.order, direction: "ascending" }],
        }),
      "fetchOutcomes",
    ),
    fetchPortfolioAssets(),
  ]);

  // Build examples grouped by quadrant
  const pbExamples: Record<string, PackExample[]> = {};
  for (const asset of portfolioAssets) {
    if (!asset.showInPackageBuilder) continue;
    for (const q of asset.quadrants) {
      if (!pbExamples[q]) pbExamples[q] = [];
      pbExamples[q].push({
        id: asset.id,
        title: asset.name,
        type: asset.assetType,
        icon: asset.icon,
        url: asset.url,
        detail: asset.description,
        thumbnailUrl: asset.thumbnailUrl,
        tags: asset.tags,
        quadrants: asset.quadrants,
      });
    }
  }

  // Build quadrants map
  const quadrants: Record<string, { title: string; promise: string; quadrantStory: string; story: string; crossover: string }> = {};
  for (const page of quadrantsRes.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;
    const key = getSelect(props[qp.key]);
    if (!key) continue;
    quadrants[key] = {
      title: getText(props[qp.title]),
      promise: getText(props[qp.promise]),
      quadrantStory: getText(props[qp.quadrantStory]),
      story: getText(props[qp.story]),
      crossover: getText(props[qp.crossover]),
    };
  }

  // Build outcomes grouped by quadrant
  const outcomes: Record<string, { title: string; detail: string }[]> = {};
  for (const page of outcomesRes.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;
    const quadrant = getSelect(props[op.quadrant]);
    if (!quadrant) continue;
    if (!outcomes[quadrant]) outcomes[quadrant] = [];
    outcomes[quadrant].push({
      title: getTitle(props[op.name]),
      detail: getText(props[op.detail]),
    });
  }

  // Assemble packs
  const packs: Record<string, PackData> = {};
  for (const [key, q] of Object.entries(quadrants)) {
    packs[key] = {
      ...q,
      outcomes: outcomes[key] ?? [],
      examples: pbExamples[key] ?? [],
    };
  }

  return packs;
}
