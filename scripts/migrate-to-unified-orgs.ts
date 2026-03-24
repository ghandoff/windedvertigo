#!/usr/bin/env npx tsx
/**
 * migrate-to-unified-orgs.ts
 *
 * Merges the "groups" and "market map" Notion databases into a single
 * "organizations" database by extending groups with market map fields,
 * then migrating market map records into it.
 *
 * Strategy: EXTEND groups (don't create a new DB), so all existing
 * relations from contacts/projects/BD assets remain valid.
 *
 * Steps:
 *   1. Add market map fields to the groups DB schema
 *   2. Rename groups → "organizations"
 *   3. Read all market map records
 *   4. Read all existing groups records (to match by org name)
 *   5. For each market map record:
 *      - If an org with the same name exists in groups → update it with BD fields
 *      - If no match → create a new page in organizations
 *   6. Map old market map page IDs → new/updated org page IDs
 *   7. Update competitive landscape relations to point to org pages
 *   8. Create operational views
 *   9. Archive the old market map DB
 *  10. Log migration report
 *
 * Usage:
 *   NOTION_TOKEN=secret_... npx tsx scripts/migrate-to-unified-orgs.ts
 *
 * Run with --dry-run to preview without making changes:
 *   NOTION_TOKEN=secret_... npx tsx scripts/migrate-to-unified-orgs.ts --dry-run
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

// ── config ────────────────────────────────────────────────

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error("NOTION_TOKEN environment variable is required");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

const notion = new Client({ auth: NOTION_TOKEN });

// Database IDs (data source / collection IDs)
const GROUPS_DB_ID = "0d72822c-6d4e-4f0a-b737-620245147b7b";
const MARKET_MAP_DB_ID = "0e845609-09d0-42fa-891c-84d09ad9d413";
const COMPETITIVE_DB_ID = "e65109a0-cbf9-49f6-871c-16643a7d010a";

// ── helpers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

function getTitle(props: Props, key: string): string {
  const p = props[key];
  if (!p || p.type !== "title") return "";
  return p.title.map((t: { plain_text: string }) => t.plain_text).join("");
}

function getText(props: Props, key: string): string {
  const p = props[key];
  if (!p || p.type !== "rich_text") return "";
  return p.rich_text.map((t: { plain_text: string }) => t.plain_text).join("");
}

function getSelect(props: Props, key: string): string {
  const p = props[key];
  if (!p || p.type !== "select") return "";
  return p.select?.name ?? "";
}

function getMultiSelect(props: Props, key: string): string[] {
  const p = props[key];
  if (!p || p.type !== "multi_select") return [];
  return p.multi_select.map((s: { name: string }) => s.name);
}

function getEmail(props: Props, key: string): string {
  const p = props[key];
  if (!p || p.type !== "email") return "";
  return p.email ?? "";
}

function getUrl(props: Props, key: string): string {
  const p = props[key];
  if (!p || p.type !== "url") return "";
  return p.url ?? "";
}

function getRelation(props: Props, key: string): string[] {
  const p = props[key];
  if (!p || p.type !== "relation") return [];
  return p.relation.map((r: { id: string }) => r.id);
}

async function queryAll(databaseId: string): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  let round = 0;

  do {
    round++;
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    for (const page of response.results) {
      if ("properties" in page) pages.push(page as PageObjectResponse);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor && round < 50);

  return pages;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Rate-limit aware wrapper (Notion API: ~3 req/s)
let lastRequest = 0;
async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < 350) await sleep(350 - elapsed);
  lastRequest = Date.now();
  return fn();
}

// ── step 1: extend groups schema with market map fields ───

async function extendGroupsSchema() {
  console.log("\n📐 Step 1: Adding market map fields to groups database...");

  // These are the fields from market map that don't exist in groups.
  // Using the Notion API to add properties to the existing database.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newProperties: Record<string, any> = {
    email: { email: {} },
    "outreach target": { rich_text: {} },
    priority: {
      select: {
        options: [
          { name: "Tier 1 – Pursue now", color: "red" },
          { name: "Tier 2 – Warm up", color: "yellow" },
          { name: "Tier 3 – Monitor", color: "gray" },
        ],
      },
    },
    "fit rating": {
      select: {
        options: [
          { name: "🔥 Perfect fit", color: "red" },
          { name: "✅ Strong fit", color: "green" },
          { name: "🟡 Moderate fit", color: "yellow" },
        ],
      },
    },
    friendship: {
      select: {
        options: [
          { name: "Inner circle", color: "blue" },
          { name: "Warm friend", color: "brown" },
          { name: "Friendly contact", color: "orange" },
          { name: "Loose tie", color: "default" },
          { name: "Known-of / name in common", color: "gray" },
          { name: "Stranger", color: "red" },
        ],
      },
    },
    "how they buy": {
      select: {
        options: [
          { name: "RFP/Tender", color: "gray" },
          { name: "Direct outreach", color: "blue" },
          { name: "Warm intro", color: "green" },
          { name: "Conference", color: "purple" },
          { name: "Open call/Grant", color: "orange" },
          { name: "Subcontract", color: "red" },
        ],
      },
    },
    "market segment": {
      select: {
        options: [
          { name: "Higher Education / Business Schools", color: "blue" },
          { name: "International Development / NGO Programmes", color: "blue" },
          { name: "Corporate L&D / Social Impact", color: "blue" },
          { name: "Government Education Agencies", color: "blue" },
          { name: "Foundations Running Grantee Programmes", color: "blue" },
          { name: "EdTech VCs & Investment Firms", color: "purple" },
          { name: "Foundations (Evidence for Impact)", color: "purple" },
          { name: "UN Agencies & Multilaterals", color: "purple" },
          { name: "Government Education Evaluation", color: "purple" },
          { name: "EdTech Companies Seeking Certification", color: "purple" },
          { name: "Toy & Game Companies", color: "green" },
          { name: "EdTech Product Companies", color: "green" },
          { name: "Museum & Exhibit Design", color: "green" },
          { name: "Publishers & Content Companies", color: "green" },
          { name: "Social Impact Product Organisations", color: "green" },
          { name: "EdTech Pre-Launch / Seeking Evidence", color: "orange" },
          { name: "Toy Companies Needing Impact Evidence", color: "orange" },
          { name: "Museums & Cultural Institutions (Eval)", color: "orange" },
          { name: "Accessibility / UDL Compliance", color: "orange" },
          { name: "Intl Development / Global EdTech Validation", color: "orange" },
        ],
      },
    },
    quadrant: {
      select: {
        options: [
          { name: "Design + Deploy", color: "blue" },
          { name: "Pinpoint + Prove", color: "purple" },
          { name: "Build + Iterate", color: "green" },
          { name: "Test + Validate", color: "orange" },
        ],
      },
    },
    "cross-quadrant": {
      multi_select: {
        options: [
          { name: "Design + Deploy", color: "blue" },
          { name: "Pinpoint + Prove", color: "purple" },
          { name: "Build + Iterate", color: "green" },
          { name: "Test + Validate", color: "orange" },
        ],
      },
    },
    "service line": {
      multi_select: {
        options: [
          { name: "In-person trainings", color: "blue" },
          { name: "Learning experiences", color: "blue" },
          { name: "Programmes", color: "blue" },
          { name: "Comms assets/webinars", color: "blue" },
          { name: "Co-design facilitation", color: "blue" },
          { name: "Programme evaluation", color: "purple" },
          { name: "MEL touchpoints", color: "purple" },
          { name: "Psychometrics", color: "purple" },
          { name: "Evidence for funders", color: "purple" },
          { name: "Thought leadership", color: "purple" },
          { name: "Learning tools", color: "green" },
          { name: "Toys & games", color: "green" },
          { name: "Inclusive & universal learning design/UDL", color: "green" },
          { name: "Exhibit efficacy", color: "orange" },
          { name: "Toy impacts", color: "orange" },
          { name: "UDL validation", color: "orange" },
          { name: "Usability testing", color: "orange" },
        ],
      },
    },
    "target service(s)": { rich_text: {} },
    "buying trigger": { rich_text: {} },
    "buyer role": { rich_text: {} },
    "bespoke email copy": { rich_text: {} },
    "outreach suggestion": { rich_text: {} },
    competitors: {
      relation: {
        database_id: COMPETITIVE_DB_ID,
        single_property: {},
      },
    },
  };

  if (DRY_RUN) {
    console.log(`  [dry-run] Would add ${Object.keys(newProperties).length} properties to groups DB`);
    return;
  }

  await rateLimited(() =>
    notion.databases.update({
      database_id: GROUPS_DB_ID,
      properties: newProperties,
    }),
  );

  console.log(`  ✓ Added ${Object.keys(newProperties).length} properties`);
}

// ── step 2: rename groups → organizations ─────────────────

async function renameDatabase() {
  console.log("\n📝 Step 2: Renaming groups → organizations...");

  if (DRY_RUN) {
    console.log("  [dry-run] Would rename database");
    return;
  }

  await rateLimited(() =>
    notion.databases.update({
      database_id: GROUPS_DB_ID,
      title: [{ text: { content: "organizations" } }],
      icon: { type: "emoji", emoji: "🏢" },
    }),
  );

  console.log("  ✓ Renamed to 'organizations'");
}

// ── step 3–5: migrate market map records ──────────────────

/** Map market map outreach status → groups connection status */
function mapOutreachToConnection(outreachStatus: string): string {
  switch (outreachStatus) {
    case "Not started":
      return "unengaged";
    case "Researching":
      return "exploring";
    case "Contacted":
    case "In conversation":
    case "Proposal sent":
      return "in progress";
    case "Active client":
      return "collaborating";
    default:
      return "unengaged";
  }
}

async function migrateMarketMapRecords() {
  console.log("\n📦 Step 3: Reading existing organizations (groups) records...");
  const existingOrgs = await queryAll(GROUPS_DB_ID);
  console.log(`  Found ${existingOrgs.length} existing organizations`);

  // Build name→page lookup for dedup
  const orgByName = new Map<string, PageObjectResponse>();
  for (const page of existingOrgs) {
    const name = getTitle(page.properties, "group name").toLowerCase().trim();
    if (name) orgByName.set(name, page);
  }

  console.log("\n📥 Step 4: Reading market map records...");
  const marketMapRecords = await queryAll(MARKET_MAP_DB_ID);
  console.log(`  Found ${marketMapRecords.length} market map records`);

  console.log("\n🔄 Step 5: Migrating market map records into organizations...");

  const idMapping = new Map<string, string>(); // old market map page ID → new/updated org page ID
  let created = 0;
  let merged = 0;
  let skipped = 0;

  for (const mmPage of marketMapRecords) {
    const orgName = getTitle(mmPage.properties, "Organization");
    if (!orgName) {
      console.log(`  ⚠ Skipping record with no name: ${mmPage.id}`);
      skipped++;
      continue;
    }

    // Build the BD properties from market map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bdProperties: Record<string, any> = {};

    const email = getEmail(mmPage.properties, "Email");
    if (email) bdProperties["email"] = { email };

    const outreachTarget = getText(mmPage.properties, "Outreach Target");
    if (outreachTarget) bdProperties["outreach target"] = { rich_text: [{ text: { content: outreachTarget } }] };

    const priority = getSelect(mmPage.properties, "Priority");
    if (priority) bdProperties["priority"] = { select: { name: priority } };

    const fitRating = getSelect(mmPage.properties, "Fit Rating");
    if (fitRating) bdProperties["fit rating"] = { select: { name: fitRating } };

    const friendship = getSelect(mmPage.properties, "friendship");
    if (friendship) bdProperties["friendship"] = { select: { name: friendship } };

    const howTheyBuy = getSelect(mmPage.properties, "How They Buy");
    if (howTheyBuy) bdProperties["how they buy"] = { select: { name: howTheyBuy } };

    const marketSegment = getSelect(mmPage.properties, "Market Segment");
    if (marketSegment) bdProperties["market segment"] = { select: { name: marketSegment } };

    const quadrant = getSelect(mmPage.properties, "Quadrant");
    if (quadrant) bdProperties["quadrant"] = { select: { name: quadrant } };

    const crossQuadrant = getMultiSelect(mmPage.properties, "Cross-Quadrant");
    if (crossQuadrant.length) bdProperties["cross-quadrant"] = { multi_select: crossQuadrant.map((n) => ({ name: n })) };

    const serviceLine = getMultiSelect(mmPage.properties, "Service Line");
    if (serviceLine.length) bdProperties["service line"] = { multi_select: serviceLine.map((n) => ({ name: n })) };

    const targetServices = getText(mmPage.properties, "Target Service(s)");
    if (targetServices) bdProperties["target service(s)"] = { rich_text: [{ text: { content: targetServices } }] };

    const buyingTrigger = getText(mmPage.properties, "Buying Trigger");
    if (buyingTrigger) bdProperties["buying trigger"] = { rich_text: [{ text: { content: buyingTrigger } }] };

    const buyerRole = getText(mmPage.properties, "Buyer Role");
    if (buyerRole) bdProperties["buyer role"] = { rich_text: [{ text: { content: buyerRole } }] };

    const bespokeEmailCopy = getText(mmPage.properties, "Bespoke Email Copy");
    if (bespokeEmailCopy) bdProperties["bespoke email copy"] = { rich_text: [{ text: { content: bespokeEmailCopy } }] };

    const outreachSuggestion = getText(mmPage.properties, "Outreach Suggestion");
    if (outreachSuggestion) bdProperties["outreach suggestion"] = { rich_text: [{ text: { content: outreachSuggestion } }] };

    const notes = getText(mmPage.properties, "Notes");
    const competitorIds = getRelation(mmPage.properties, "Related to Competitive Landscape (Market Map Orgs)");
    if (competitorIds.length) bdProperties["competitors"] = { relation: competitorIds.map((id) => ({ id })) };

    const url = getUrl(mmPage.properties, "userDefined:URL");

    // Check if this org already exists in groups
    const existingOrg = orgByName.get(orgName.toLowerCase().trim());

    if (existingOrg) {
      // Merge: update existing org with BD fields
      if (DRY_RUN) {
        console.log(`  [dry-run] Would merge "${orgName}" into existing org ${existingOrg.id}`);
      } else {
        await rateLimited(() =>
          notion.pages.update({
            page_id: existingOrg.id,
            properties: bdProperties,
          }),
        );
        console.log(`  ✓ Merged "${orgName}" → ${existingOrg.id}`);
      }
      idMapping.set(mmPage.id, existingOrg.id);
      merged++;
    } else {
      // Create: new page in organizations DB
      const outreachStatus = getSelect(mmPage.properties, "Outreach Status");
      const connectionStatus = mapOutreachToConnection(outreachStatus);

      const createProperties = {
        "group name": { title: [{ text: { content: orgName } }] },
        connection: { status: { name: connectionStatus } },
        ...bdProperties,
        ...(url ? { website: { url } } : {}),
        ...(notes ? { notes: { rich_text: [{ text: { content: notes } }] } } : {}),
      };

      if (DRY_RUN) {
        console.log(`  [dry-run] Would create "${orgName}" (connection: ${connectionStatus})`);
        idMapping.set(mmPage.id, "DRY_RUN_ID");
      } else {
        const newPage = await rateLimited(() =>
          notion.pages.create({
            parent: { database_id: GROUPS_DB_ID },
            properties: createProperties,
          }),
        );
        console.log(`  ✓ Created "${orgName}" → ${newPage.id} (connection: ${connectionStatus})`);
        idMapping.set(mmPage.id, newPage.id);
      }
      created++;
    }
  }

  console.log(`\n  Summary: ${created} created, ${merged} merged, ${skipped} skipped`);
  return idMapping;
}

// ── step 6: update competitive landscape relations ────────

async function updateCompetitiveRelations(idMapping: Map<string, string>) {
  console.log("\n🔗 Step 6: Updating competitive landscape relations...");

  const competitors = await queryAll(COMPETITIVE_DB_ID);
  let updated = 0;

  for (const comp of competitors) {
    const oldRelIds = getRelation(comp.properties, "Market Map Orgs");
    if (!oldRelIds.length) continue;

    const newRelIds = oldRelIds
      .map((oldId) => idMapping.get(oldId) ?? oldId)
      .filter((id) => id !== "DRY_RUN_ID");

    // Only update if any IDs actually changed
    const changed = oldRelIds.some((oldId) => idMapping.has(oldId));
    if (!changed) continue;

    if (DRY_RUN) {
      const orgName = getTitle(comp.properties, "Organisation");
      console.log(`  [dry-run] Would update "${orgName}" relations: ${oldRelIds.length} → ${newRelIds.length}`);
    } else {
      await rateLimited(() =>
        notion.pages.update({
          page_id: comp.id,
          properties: {
            "Market Map Orgs": {
              relation: newRelIds.map((id) => ({ id })),
            },
          },
        }),
      );
    }
    updated++;
  }

  console.log(`  Updated ${updated} competitor records`);
}

// ── step 7: archive old market map ────────────────────────

async function archiveMarketMap() {
  console.log("\n🗄️  Step 7: Archiving old market map database...");

  if (DRY_RUN) {
    console.log("  [dry-run] Would archive market map database");
    return;
  }

  // Notion API doesn't support archiving/deleting databases directly.
  // We'll rename it to indicate it's archived and add a note.
  await rateLimited(() =>
    notion.databases.update({
      database_id: MARKET_MAP_DB_ID,
      title: [{ text: { content: "🗄️ [ARCHIVED] market map — migrated to organizations" } }],
      icon: { type: "emoji", emoji: "🗄️" },
    }),
  );

  console.log("  ✓ Market map renamed to indicate archived status");
}

// ── main ──────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Winded Vertigo — Database Migration Script");
  console.log("  groups + market map → organizations");
  if (DRY_RUN) console.log("  🏜️  DRY RUN MODE — no changes will be made");
  console.log("═══════════════════════════════════════════════");

  try {
    // Step 1: Extend groups schema
    await extendGroupsSchema();

    // Step 2: Rename
    await renameDatabase();

    // Steps 3–5: Migrate market map records
    const idMapping = await migrateMarketMapRecords();

    // Step 6: Update competitive landscape relations
    await updateCompetitiveRelations(idMapping);

    // Step 7: Archive old market map
    await archiveMarketMap();

    // Print report
    console.log("\n═══════════════════════════════════════════════");
    console.log("  Migration complete!");
    console.log(`  Organizations DB ID: ${GROUPS_DB_ID}`);
    console.log(`  (Use this as CRM_ORGANIZATIONS_DB_ID in your .env)`);
    console.log("═══════════════════════════════════════════════");
    console.log("\n⚡ Next steps:");
    console.log("  1. Set CRM_ORGANIZATIONS_DB_ID=" + GROUPS_DB_ID + " in crm/.env.local");
    console.log("  2. Create operational views in the Notion UI or via API");
    console.log("  3. Verify contacts, projects, BD assets relations still work");
    console.log("  4. Share the organizations DB with your Notion integration if needed");
  } catch (err) {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  }
}

main();
