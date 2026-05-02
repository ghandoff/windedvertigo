/**
 * Notion data fetching for the harbour app.
 *
 * Replaces the old JSON-file pipeline (fetch-notion.js → harbour/data/*.json)
 * with direct Notion API calls from server components + ISR caching.
 *
 * Property extraction logic ported from scripts/fetch-notion.js.
 */

import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  RichTextItemResponse,
  QueryDataSourceParameters,
  QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";

// ── client ────────────────────────────────────────────────
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── tile image URL builder ────────────────────────────────
/**
 * Construct a tile image URL for a given slug.
 *
 * Uses R2 when R2_PUBLIC_URL is set (production CF Workers; images synced
 * via scripts/sync-tiles-to-r2.mjs). Falls back to /harbour/images/{slug}.png
 * (the static files committed to the repo) when R2 isn't configured or the
 * slug hasn't been synced yet — Next.js's <Image> component handles 404s
 * gracefully via the next/image error handler in tile components.
 *
 * Centralising images in R2 lets us update them without redeploying and
 * keeps the repo lean as the catalog grows past ~20 tiles.
 */
function tileImageUrl(slug: string): string {
  const r2 = process.env.R2_PUBLIC_URL;
  if (!r2) return `/harbour/images/${slug}.png`;
  return `${r2.replace(/\/$/, "")}/harbour-tiles/${slug}.png`;
}

// ── v5 data-source adapter ────────────────────────────────
// Notion API split databases into "databases" (metadata) and "data sources"
// (queryable rows). v5 query is on dataSources; we resolve and cache the
// data_source_id once per database ID to keep call sites compact.
const dataSourceCache = new Map<string, string>();

async function getDataSourceId(databaseId: string): Promise<string | null> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) return cached;
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    if (
      "data_sources" in db &&
      Array.isArray((db as { data_sources?: { id: string }[] }).data_sources) &&
      (db as { data_sources: { id: string }[] }).data_sources.length > 0
    ) {
      const id = (db as { data_sources: { id: string }[] }).data_sources[0].id;
      dataSourceCache.set(databaseId, id);
      return id;
    }
  } catch {
    // If retrieval fails, fall through to databases.query() fallback
  }
  // data_sources absent or empty — signal to use databases.query() fallback
  return null;
}

/** Query a data source by the legacy database ID.
 *
 *  Tries the v5 `dataSources.query()` API first (which requires a
 *  `data_source_id`). If the Notion workspace doesn't expose `data_sources`
 *  on the database (some workspaces still use the v4 shape), falls back to
 *  `databases.query()` which works identically for our purposes.
 */
async function queryDataSource(
  databaseId: string,
  params: Omit<QueryDataSourceParameters, "data_source_id">,
): Promise<QueryDataSourceResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = notion as any;

  const dataSourceId = await getDataSourceId(databaseId);

  if (
    dataSourceId &&
    typeof client.dataSources?.query === "function"
  ) {
    return client.dataSources.query({ data_source_id: dataSourceId, ...params });
  }

  // Fallback: v4-style databases.query() — same response shape for our extractors
  return client.databases.query({ database_id: databaseId, ...params }) as Promise<QueryDataSourceResponse>;
}

// ── database IDs ──────────────────────────────────────────
const DB = {
  harbourGames: "8e3f3364b2654640a91ed0f38b091a07",
  depthChart:
    process.env.NOTION_DEPTH_CHART_DB_ID ||
    "38873e53f36f4b2885552fdf6cdc98cb",
  siteContent: "09a046a556c1455e80073546b8f83297",
} as const;

// ── property names (maps to Notion column names) ──────────
const PROPS = {
  harbourGames: {
    name: "Name",
    slug: "Slug",
    tagline: "Tagline",
    description: "Description",
    icon: "Icon",
    tileImage: "Tile Image",
    brandColor: "Brand Color",
    accentColor: "Accent Color",
    features: "Features",
    href: "Href",
    status: "Status",
    order: "Order",
  },
  depthChart: {
    name: "Name",
    slug: "Slug",
    domain: "Domain",
    skillset: "Skillset",
    description: "Description",
    icon: "Icon",
    howToPractice: "How to Practice",
    order: "Order",
    status: "Status",
  },
  siteContent: {
    name: "Name",
    content: "Content",
    tagline: "Tagline",
    order: "Order",
    type: "Content Type",
    page: "Page",
    section: "Section",
    icon: "Icon",
    link: "Link",
    status: "Status",
  },
} as const;

// ── types ─────────────────────────────────────────────────

export interface Game {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  accentColor: string;
  icon: string;
  image?: string;
  features: string[];
  href: string;
  status: "live" | "coming-soon";
  order: number;
}

export interface Skill {
  slug: string;
  name: string;
  domain: string;
  skillsets: string[];
  description: string;
  icon: string;
  howToPractice: string;
  order: number;
}

export interface CredibilityData {
  sectionLabel: string;
  sectionHeading: string;
  credentials: { icon: string; label: string; detail: string }[];
  principles: { heading: string; body: string }[];
  bio: { text: string; link: string } | null;
  hero: { title: string; subtitle: string; tagline: string } | null;
  cta: { heading: string; body: string } | null;
  connection: {
    heading: string;
    body: string;
    link: string;
    linkLabel: string;
  } | null;
}

// ── property extractors ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Notion SDK unions are unwieldy; runtime checks are safe.
type Prop = any;

function getText(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "rich_text")
    return prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join("");
  return "";
}

function getTitle(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "title")
    return prop.title.map((t: { plain_text: string }) => t.plain_text).join("");
  return "";
}

function getRichTextAsMarkdown(prop: Prop | undefined): string {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text
    .map((t: RichTextItemResponse) => {
      let text = t.plain_text;
      if (t.annotations?.bold) text = "**" + text + "**";
      if (t.annotations?.italic) text = "*" + text + "*";
      if (t.type === "text" && t.text?.link?.url)
        text = "[" + text + "](" + t.text.link.url + ")";
      return text;
    })
    .join("");
}

function getSelect(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name ?? "";
  return "";
}

function getMultiSelect(prop: Prop | undefined): string[] {
  if (!prop) return [];
  if (prop.type === "multi_select")
    return prop.multi_select.map((s: { name: string }) => s.name);
  return [];
}

function getUrl(prop: Prop | undefined): string {
  if (!prop) return "";
  if (prop.type === "url") return prop.url ?? "";
  return "";
}

function getNumber(prop: Prop | undefined): number | null {
  if (!prop) return null;
  if (prop.type === "number") return prop.number;
  return null;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── retry wrapper ─────────────────────────────────────────

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
          `[notion] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms…`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

// ── fallback-aware wrapper ─────────────────────────────────

// ── fetchers ──────────────────────────────────────────────

/**
 * Fetch harbour games from Notion.
 *
 * Note: tile images remain as static files in public/images/ because
 * Notion's signed file URLs expire after ~1 hour. Images are sourced
 * from each page's **cover image** in the harbour games database.
 * Run `node scripts/sync-harbour-tiles.mjs` to download fresh copies.
 */
export function fetchGames(): Promise<Game[]> {
  return _fetchGames();
}

async function _fetchGames(): Promise<Game[]> {
  const p = PROPS.harbourGames;

  const response = await withRetry(
    () =>
      queryDataSource(DB.harbourGames, {
        sorts: [{ property: p.order, direction: "ascending" }],
      }),
    "fetchGames",
  );

  const games: Game[] = [];

  for (const page of response.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;

    const name = getTitle(props[p.name]);
    const slug = getText(props[p.slug]);
    if (!name || !slug) continue;

    const status = getSelect(props[p.status]) || "live";
    const featuresRaw = getText(props[p.features]);

    games.push({
      slug,
      name,
      tagline: getText(props[p.tagline]),
      description: getText(props[p.description]),
      icon: getText(props[p.icon]),
      // Tile image: prefer R2 (synced via scripts/sync-tiles-to-r2.mjs;
      // images are permanent there). Fall back to public/images/ if the R2
      // URL is unset or the slug hasn't been synced yet.
      image: tileImageUrl(slug),
      color: getText(props[p.brandColor]),
      accentColor: getText(props[p.accentColor]),
      features: featuresRaw
        ? featuresRaw
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean)
        : [],
      href: getUrl(props[p.href]),
      status: status as "live" | "coming-soon",
      order: getNumber(props[p.order]) ?? 0,
    });
  }

  return games;
}

/**
 * Fetch depth.chart skills from Notion.
 */
export function fetchSkills(): Promise<Skill[]> {
  return _fetchSkills();
}

async function _fetchSkills(): Promise<Skill[]> {
  const p = PROPS.depthChart;

  const response = await withRetry(
    () =>
      queryDataSource(DB.depthChart, {
        sorts: [{ property: p.order, direction: "ascending" }],
      }),
    "fetchSkills",
  );

  const skills: Skill[] = [];

  for (const page of response.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;

    const name = getTitle(props[p.name]);
    const domain = getSelect(props[p.domain]);
    if (!name || !domain) continue;

    const status = getSelect(props[p.status]);
    if (status && status !== "live") continue;

    skills.push({
      slug: getText(props[p.slug]) || toSlug(name),
      name,
      domain,
      skillsets: getMultiSelect(props[p.skillset]),
      description: getText(props[p.description]),
      icon: getText(props[p.icon]),
      howToPractice: getText(props[p.howToPractice]),
      order: getNumber(props[p.order]) ?? 0,
    });
  }

  return skills;
}

/**
 * Fetch harbour credibility data from the Site Content CMS.
 *
 * This extracts the "harbour" page sections from the shared CMS database
 * and reshapes them into the CredibilityData structure that the harbour
 * app's components expect.
 */
export function fetchCredibility(): Promise<CredibilityData> {
  return _fetchCredibility();
}

async function _fetchCredibility(): Promise<CredibilityData> {
  const p = PROPS.siteContent;

  // Paginated query — fetch only "harbour" page sections
  let allPages: PageObjectResponse[] = [];
  let startCursor: string | undefined;
  let round = 0;

  do {
    round++;
    const response = await withRetry(
      () =>
        queryDataSource(DB.siteContent, {
          filter: {
            property: p.page,
            select: { equals: "harbour" },
          },
          sorts: [{ property: p.order, direction: "ascending" }],
          page_size: 100,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        }),
      `fetchCredibility:round${round}`,
    );

    for (const page of response.results) {
      if ("properties" in page) allPages.push(page as PageObjectResponse);
    }

    startCursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (startCursor && round < 5);

  // Extract sections — same logic as fetch-notion.js main()
  interface Section {
    name: string;
    content: string;
    tagline: string;
    order: number | null;
    type: string;
    section: string;
    icon: string;
    link: string;
  }

  const sections: Section[] = [];
  for (const page of allPages) {
    const props = page.properties;
    const status = getSelect(props[p.status]);
    if (status && status !== "live") continue;

    sections.push({
      name: getTitle(props[p.name]),
      content: getRichTextAsMarkdown(props[p.content]),
      tagline: getText(props[p.tagline]),
      order: getNumber(props[p.order]),
      type: getSelect(props[p.type]),
      section: getText(props[p.section]),
      icon: getText(props[p.icon]),
      link: getUrl(props[p.link]),
    });
  }

  // Reshape into CredibilityData — mirrors fetch-notion.js extraction
  const credentials = sections
    .filter((s) => s.type === "credential" && s.section === "why")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({ icon: s.icon, label: s.name, detail: s.content }));

  const principles = sections
    .filter((s) => s.type === "principle" && s.section === "principles")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({ heading: s.name, body: s.content }));

  const bioSection = sections.find(
    (s) => s.type === "body" && s.section === "bio",
  );
  const heroSection = sections.find(
    (s) => s.section === "hero" && s.type === "hero",
  );
  const whyHeader = sections.find((s) => s.section === "why-header");
  const ctaSection = sections.find(
    (s) => s.section === "closing-cta" && s.type === "cta",
  );

  return {
    sectionLabel: whyHeader?.tagline ?? "why these tools",
    sectionHeading:
      whyHeader?.content ?? "built by people who study how humans grow",
    credentials,
    principles,
    bio: bioSection
      ? { text: bioSection.content, link: bioSection.link }
      : null,
    hero: heroSection
      ? {
          title: heroSection.name,
          subtitle: heroSection.content,
          tagline: heroSection.tagline,
        }
      : null,
    cta: ctaSection
      ? { heading: ctaSection.name, body: ctaSection.content }
      : null,
    connection: bioSection
      ? {
          heading: whyHeader?.name ?? "who holds the harbour",
          body: bioSection.content,
          link: bioSection.link,
          linkLabel: "there is more water beyond this harbour",
        }
      : null,
  };
}
