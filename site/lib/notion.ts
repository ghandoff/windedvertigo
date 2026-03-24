/**
 * Notion data fetching for the winded.vertigo static site.
 *
 * Replaces the old pipeline: GitHub Actions → fetch-notion.js → JSON files → client-side fetch.
 * Now: server components query Notion directly, cached via ISR.
 *
 * Property extraction logic ported from scripts/fetch-notion.js.
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import fs from "fs";
import path from "path";
import { syncImageToR2, imageUrl } from "@/lib/sync-image";

// ── client ────────────────────────────────────────────────
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── database IDs ──────────────────────────────────────────
const DB = {
  siteContent: "09a046a556c1455e80073546b8f83297",
  portfolioAssets: "5e27b792adbb4a958779900fb59dd631",
  quadrants: "1c171d25825b418caf94805dc1568352",
  outcomes: "b8ff41d2d4ef41559e01c2d952a3a1da",
  vertigoVault: "223e4ee74ba4805f8c92cda6e2b8ba00",
  conferenceScreens: "66b266f68a664524829d39a3621a0754",
  conferenceItems: "6beb2d506e604b898a2232b510a432bb",
  conferenceAgenda: "bd92b25081344df79021bd5888d22806",
} as const;

// ── property names ────────────────────────────────────────
const PROPS = {
  siteContent: {
    name: "Name",
    content: "Content",
    tagline: "Tagline",
    order: "Order",
    type: "Content Type",
    page: "Page",
    section: "Section",
    icon: "Icon",
    features: "Features",
    brandColor: "Brand Color",
    accentColor: "Accent Color",
    textColor: "Text Color",
    link: "Link",
    imageUrl: "Image URL",
    status: "Status",
  },
  portfolioAssets: {
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
  },
  quadrants: {
    key: "Quadrant Key",
    title: "Title",
    promise: "Promise",
    quadrantStory: "Quadrant Story",
    story: "how we work",
    crossover: "crossover note",
  },
  outcomes: {
    quadrant: "Quadrant",
    name: "Name",
    detail: "Detail",
    order: "Order",
  },
  conferenceScreens: {
    screenId: "Screen ID",
    order: "Order",
    screenType: "Screen Type",
    timeLabel: "Time Label",
    heading: "Heading",
    body: "Body",
    secondaryBody: "Secondary Body",
    backgroundImageUrl: "Background Image URL",
    backgroundOverlay: "Background Overlay",
    navTime: "Nav Time",
    navLabel: "Nav Label",
    showNav: "Show Nav",
    narratorScene: "Narrator Scene",
    narratorText: "Narrator Text",
    ariaLabel: "Aria Label",
    status: "Status",
  },
  conferenceItems: {
    name: "Name",
    screen: "Screen",
    itemType: "Item Type",
    order: "Order",
    text: "Text",
    secondaryText: "Secondary Text",
    isChildVoice: "Is Child Voice",
    variant: "Variant",
    url: "URL",
  },
  conferenceAgenda: {
    label: "Label",
    time: "Time",
    screenNumber: "Screen Number",
    screen: "Screen",
    order: "Order",
  },
} as const;

// ── types ─────────────────────────────────────────────────

export interface SiteSection {
  name: string;
  content: string;
  tagline: string;
  order: number | null;
  type: string;
  section: string;
  icon: string;
  features: string;
  brandColor: string;
  accentColor: string;
  textColor: string;
  link: string;
  imageUrl: string;
}

export interface PortfolioAsset {
  id: string;
  name: string;
  slug: string;
  assetType: string;
  quadrants: string[];
  quadrantKey: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  tags: string[];
  featured: boolean;
  showInPackageBuilder: boolean;
  showInPortfolio: boolean;
  icon: string;
  order: number | null;
}

/** Asset shape shared between PackData examples and the AssetModal component. */
export interface ModalAsset {
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
  examples: ModalAsset[];
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  headshot: string;
  tags: string[];
  link: string;
}

// ── property extractors ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Prop = any;

function getText(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "rich_text")
    return prop.rich_text
      .map((t: { plain_text: string }) => t.plain_text)
      .join("");
  return "";
}

function getTitle(prop: Prop): string {
  if (!prop) return "";
  if (prop.type === "title")
    return prop.title
      .map((t: { plain_text: string }) => t.plain_text)
      .join("");
  return "";
}

function getRichTextAsMarkdown(prop: Prop): string {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text
    .map(
      (t: {
        plain_text: string;
        annotations?: { bold?: boolean; italic?: boolean };
        text?: { link?: { url?: string } };
      }) => {
        let text = t.plain_text;
        if (t.annotations?.bold) text = "**" + text + "**";
        if (t.annotations?.italic) text = "*" + text + "*";
        if (t.text?.link?.url) text = "[" + text + "](" + t.text.link.url + ")";
        return text;
      },
    )
    .join("");
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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── retry + fallback ──────────────────────────────────────

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
  throw new Error(
    `${label} failed after ${maxAttempts} attempts: ${lastError?.message}`,
  );
}

function readFallback<T>(filename: string): T | null {
  try {
    const filePath = path.join(process.cwd(), "data", filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function withFallback<T>(
  fetcher: () => Promise<T>,
  fallbackFile: string,
  label: string,
): Promise<T> {
  try {
    return await fetcher();
  } catch (err) {
    console.warn(
      `[notion] ${label} failed, falling back to ${fallbackFile}: ${(err as Error).message}`,
    );
    const data = readFallback<T>(fallbackFile);
    if (data !== null) return data;
    throw err;
  }
}

// ── fetchers ──────────────────────────────────────────────

/**
 * Fetch all site content sections for a specific page.
 */
export async function fetchSiteContent(
  pageKey: string,
): Promise<SiteSection[]> {
  try {
    return await _fetchSiteContent(pageKey);
  } catch (err) {
    console.warn(
      `[notion] fetchSiteContent:${pageKey} failed, falling back to JSON: ${(err as Error).message}`,
    );
    // Fallback JSON has shape { sections: [...] }
    const data = readFallback<{ sections: SiteSection[] }>(
      `site-content-${pageKey}.json`,
    );
    if (data?.sections) return data.sections;
    throw err;
  }
}

async function _fetchSiteContent(pageKey: string): Promise<SiteSection[]> {
  const p = PROPS.siteContent;
  let allPages: PageObjectResponse[] = [];
  let startCursor: string | undefined;
  let round = 0;

  do {
    round++;
    const response = await withRetry(
      () =>
        notion.databases.query({
          database_id: DB.siteContent,
          filter: {
            property: p.page,
            select: { equals: pageKey },
          },
          sorts: [{ property: p.order, direction: "ascending" }],
          page_size: 100,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        }),
      `siteContent:${pageKey}:round${round}`,
    );

    for (const page of response.results) {
      if ("properties" in page) allPages.push(page as PageObjectResponse);
    }
    startCursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (startCursor && round < 5);

  const sections: SiteSection[] = [];
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
      features: getText(props[p.features]),
      brandColor: getSelect(props[p.brandColor]),
      accentColor: getSelect(props[p.accentColor]),
      textColor: getSelect(props[p.textColor]),
      link: getUrl(props[p.link]),
      imageUrl: getUrl(props[p.imageUrl]),
    });
  }

  return sections;
}

/**
 * Fetch portfolio assets (from BD multi-database via search).
 */
export async function fetchPortfolioAssets(): Promise<PortfolioAsset[]> {
  try {
    return await _fetchPortfolioAssets();
  } catch (err) {
    console.warn(
      `[notion] fetchPortfolioAssets failed, falling back to JSON: ${(err as Error).message}`,
    );
    // Fallback JSON has shape { assets: [...] }
    const data = readFallback<{ assets: PortfolioAsset[] }>(
      "portfolio-assets.json",
    );
    if (data?.assets) return data.assets;
    throw err;
  }
}

// quadrant relation cache
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

async function _fetchPortfolioAssets(): Promise<PortfolioAsset[]> {
  const p = PROPS.portfolioAssets;
  const parentDbId = DB.portfolioAssets;
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
      `searchBDAssets:round${round}`,
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

  const assets: PortfolioAsset[] = [];

  for (const page of allPages) {
    const props = page.properties;
    if (!props[p.name] || (props[p.name] as Prop).type !== "title") continue;

    const showInPortfolio = getCheckbox(props[p.showInPortfolio]);
    const showInPB = getCheckbox(props[p.showInPackageBuilder]);
    if (!showInPortfolio && !showInPB) continue;

    const quadrantRelIds = getRelationIds(props[p.quadrantRel]);
    const quadrantKeys = await hydrateQuadrantRel(quadrantRelIds);
    const quadrantKey = quadrantKeys[0] ?? "";
    const assetName = getTitle(props[p.name]);

    // Thumbnail priority:
    // 1. External cover URL (permanent, no expiry)
    // 2. Explicit Thumbnail URL property (self-hosted, stable)
    // 3. Notion-hosted cover file (expires ~1h, needs R2 sync)
    // We avoid using Notion file covers directly because if R2 sync fails
    // the expired S3 URL gets baked into the static page.
    const externalCoverUrl =
      page.cover?.type === "external" ? page.cover.external.url : "";
    const propertyUrl = getUrl(props[p.thumbnailUrl]);
    const notionFileCoverUrl =
      page.cover?.type === "file" ? page.cover.file.url : "";
    const rawThumbnailUrl = externalCoverUrl || propertyUrl || notionFileCoverUrl;
    let thumbnailUrl = rawThumbnailUrl;
    if (rawThumbnailUrl) {
      const r2Key = await syncImageToR2(rawThumbnailUrl, page.id, "thumbnail");
      thumbnailUrl = imageUrl(r2Key) ?? rawThumbnailUrl;
    }

    assets.push({
      id: page.id,
      name: assetName,
      slug: getText(props[p.slug]) || toSlug(assetName),
      assetType: getSelect(props[p.assetType]),
      quadrants: quadrantKey ? [quadrantKey] : [],
      quadrantKey,
      url: getUrl(props[p.url]),
      thumbnailUrl,
      description: getText(props[p.description]),
      tags: getMultiSelect(props[p.tags]),
      featured: getCheckbox(props[p.featured]),
      showInPackageBuilder: showInPB,
      showInPortfolio,
      icon: getIconValue(props[p.icon]),
      order: getNumber(props[p.order]),
    });
  }

  assets.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  return assets;
}

/**
 * Fetch package builder data (quadrants + outcomes + examples).
 */
export async function fetchPackageBuilderData(): Promise<
  Record<string, PackData>
> {
  try {
    return await _fetchPackageBuilderData();
  } catch (err) {
    console.warn(
      `[notion] fetchPackageBuilder failed, falling back to JSON: ${(err as Error).message}`,
    );
    // Fallback JSON has shape { packs: {...} }
    const data = readFallback<{ packs: Record<string, PackData> }>(
      "package-builder-content.json",
    );
    if (data?.packs) return data.packs;
    throw err;
  }
}

/** Build package builder examples from already-fetched portfolio assets.
 *  Includes full asset metadata so the in-page modal can show thumbnails,
 *  tags, quadrant badges, and related work. */
function buildPackageBuilderExamples(
  assets: PortfolioAsset[],
): Record<string, PackData["examples"]> {
  const examples: Record<string, PackData["examples"]> = {};
  for (const asset of assets) {
    if (!asset.showInPackageBuilder) continue;
    for (const q of asset.quadrants) {
      if (!examples[q]) examples[q] = [];
      examples[q].push({
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
  return examples;
}

async function _fetchPackageBuilderData(): Promise<
  Record<string, PackData>
> {
  const qp = PROPS.quadrants;
  const op = PROPS.outcomes;

  // Fetch quadrants, outcomes, and portfolio assets in parallel
  // (portfolio assets are shared — we derive PB examples from them)
  const [quadrantsRes, outcomesRes, portfolioAssets] = await Promise.all([
    withRetry(
      () => notion.databases.query({ database_id: DB.quadrants }),
      "fetchQuadrants",
    ),
    withRetry(
      () =>
        notion.databases.query({
          database_id: DB.outcomes,
          sorts: [{ property: op.order, direction: "ascending" }],
        }),
      "fetchOutcomes",
    ),
    _fetchPortfolioAssets(),
  ]);

  const pbExamples = buildPackageBuilderExamples(portfolioAssets);

  // Build quadrants
  const quadrants: Record<
    string,
    {
      title: string;
      promise: string;
      quadrantStory: string;
      story: string;
      crossover: string;
    }
  > = {};
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

  // Assemble packs (examples already grouped by quadrant from _fetchPackageBuilderExamples)
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

/**
 * Extract team members from "we" page site content.
 */
export function extractTeamMembers(
  sections: SiteSection[],
): TeamMember[] {
  return sections
    .filter((s) => s.type === "team-member")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      name: s.name,
      role: s.tagline,
      bio: s.content,
      headshot: s.imageUrl,
      tags: s.features
        ? s.features
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      link: s.link,
    }));
}

// ── conference experience types ──────────────────────────

export interface ConferenceItem {
  id: string;
  name: string;
  screenId: string; // resolved from relation
  itemType: string;
  order: number | null;
  text: string;
  secondaryText: string;
  isChildVoice: boolean;
  variant: string;
  url: string;
}

export interface ConferenceScreen {
  id: string;
  screenId: string;
  order: number;
  screenType: string;
  timeLabel: string;
  heading: string;
  body: string;
  secondaryBody: string;
  backgroundImageUrl: string;
  backgroundOverlay: string;
  navTime: string;
  navLabel: string;
  showNav: boolean;
  narratorScene: string;
  narratorText: string;
  ariaLabel: string;
  items: ConferenceItem[];
}

export interface ConferenceAgendaItem {
  label: string;
  time: string;
  screenNumber: number;
  order: number;
}

export interface ConferenceExperienceData {
  screens: ConferenceScreen[];
  agenda: ConferenceAgendaItem[];
}

// ── conference experience fetcher ────────────────────────

export async function fetchConferenceExperience(): Promise<ConferenceExperienceData> {
  return withFallback(
    () => _fetchConferenceExperience(),
    "conference-experience.json",
    "fetchConferenceExperience",
  );
}

async function _fetchConferenceExperience(): Promise<ConferenceExperienceData> {
  const sp = PROPS.conferenceScreens;
  const ip = PROPS.conferenceItems;
  const ap = PROPS.conferenceAgenda;

  // Fetch all three databases in parallel
  const [screensRes, itemsRes, agendaRes] = await Promise.all([
    withRetry(
      () =>
        notion.databases.query({
          database_id: DB.conferenceScreens,
          sorts: [{ property: sp.order, direction: "ascending" }],
        }),
      "conferenceScreens",
    ),
    withRetry(
      () =>
        notion.databases.query({
          database_id: DB.conferenceItems,
          sorts: [{ property: ip.order, direction: "ascending" }],
        }),
      "conferenceItems",
    ),
    withRetry(
      () =>
        notion.databases.query({
          database_id: DB.conferenceAgenda,
          sorts: [{ property: ap.order, direction: "ascending" }],
        }),
      "conferenceAgenda",
    ),
  ]);

  // Build screen map: page ID → screen
  const screenMap = new Map<string, ConferenceScreen>();
  const screens: ConferenceScreen[] = [];

  for (const page of screensRes.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;
    const status = getSelect(props[sp.status]);
    if (status && status !== "live") continue;

    const screen: ConferenceScreen = {
      id: page.id,
      screenId: getTitle(props[sp.screenId]),
      order: getNumber(props[sp.order]) ?? 0,
      screenType: getSelect(props[sp.screenType]),
      timeLabel: getText(props[sp.timeLabel]),
      heading: getText(props[sp.heading]),
      body: getText(props[sp.body]),
      secondaryBody: getText(props[sp.secondaryBody]),
      backgroundImageUrl: getUrl(props[sp.backgroundImageUrl]),
      backgroundOverlay: getText(props[sp.backgroundOverlay]),
      navTime: getText(props[sp.navTime]),
      navLabel: getText(props[sp.navLabel]),
      showNav: getCheckbox(props[sp.showNav]),
      narratorScene: getText(props[sp.narratorScene]),
      narratorText: getText(props[sp.narratorText]),
      ariaLabel: getText(props[sp.ariaLabel]),
      items: [],
    };
    screenMap.set(page.id, screen);
    screens.push(screen);
  }

  // Attach items to their screens via relation
  for (const page of itemsRes.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;
    const relationIds = getRelationIds(props[ip.screen]);
    const parentId = relationIds[0];
    if (!parentId) continue;

    // Normalize ID format (dashed vs undashed)
    const normalizedId = parentId.includes("-")
      ? parentId
      : parentId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

    const screen = screenMap.get(normalizedId) ?? screenMap.get(parentId);
    if (!screen) continue;

    screen.items.push({
      id: page.id,
      name: getTitle(props[ip.name]),
      screenId: screen.screenId,
      itemType: getSelect(props[ip.itemType]),
      order: getNumber(props[ip.order]),
      text: getText(props[ip.text]),
      secondaryText: getText(props[ip.secondaryText]),
      isChildVoice: getCheckbox(props[ip.isChildVoice]),
      variant: getSelect(props[ip.variant]),
      url: getUrl(props[ip.url]),
    });
  }

  // Sort items within each screen by order
  for (const screen of screens) {
    screen.items.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  }

  // Build agenda — resolve Screen relation to screen order, fall back to Screen Number
  const agenda: ConferenceAgendaItem[] = [];
  for (const page of agendaRes.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;

    // Prefer the Screen relation (structural link) over the legacy Screen Number field
    let screenNumber = getNumber(props[ap.screenNumber]) ?? 0;
    const screenRelIds = getRelationIds(props[ap.screen]);
    if (screenRelIds.length > 0) {
      const linkedId = screenRelIds[0];
      const normalizedId = linkedId.includes("-")
        ? linkedId
        : linkedId.replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5",
          );
      const linkedScreen =
        screenMap.get(normalizedId) ?? screenMap.get(linkedId);
      if (linkedScreen) {
        screenNumber = linkedScreen.order;
      }
    }

    agenda.push({
      label: getTitle(props[ap.label]),
      time: getText(props[ap.time]),
      screenNumber,
      order: getNumber(props[ap.order]) ?? 0,
    });
  }

  return { screens, agenda };
}
