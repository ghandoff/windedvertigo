/**
 * Notion CRM logging for booking events.
 *
 * Reuses the existing CRM contacts database (829cd552-...). On a new
 * booking we either create a contact or update the existing one keyed
 * by email. Sets contact_warmth=warm and writes a structured next_action.
 *
 * Patterns match site/app/api/email-package/route.ts and book-playdate.
 */

import { Client } from "@notionhq/client";

const CRM_CONTACTS_DB = "829cd552-4516-45b7-a65b-2bcd8d47ff81";

let cachedClient: Client | null = null;
let cachedDataSourceId: string | null = null;

function getClient(): Client | null {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn("[booking.notion] NOTION_TOKEN not set — skipping CRM log");
    return null;
  }
  if (!cachedClient) cachedClient = new Client({ auth: token });
  return cachedClient;
}

/**
 * Resolve the data source id for the contacts DB. Notion v5 introduced
 * data sources as a separate concept from databases — queries go through
 * data_sources, not the database id directly.
 */
async function getDataSourceId(client: Client): Promise<string | null> {
  if (cachedDataSourceId) return cachedDataSourceId;
  try {
    // The Notion JS client v5 returns data_sources at .databases.retrieve
    const db = (await client.databases.retrieve({ database_id: CRM_CONTACTS_DB })) as unknown as {
      data_sources?: { id: string }[];
    };
    const id = db?.data_sources?.[0]?.id;
    if (id) {
      cachedDataSourceId = id;
      return id;
    }
  } catch (e) {
    console.warn("[booking.notion] data source lookup failed:", String(e));
  }
  return null;
}

interface LogBookingParams {
  name: string;
  email: string;
  eventTypeSlug: string;
  eventTitle: string;
  startAt: Date;
  hostNames: string[];
  curious?: string;
  valuable?: string;
  quadrant?: string | null;
}

/**
 * Log a confirmed booking to the CRM. Idempotent-ish: dedups by email
 * and updates the existing contact if found. Failures are non-fatal and
 * logged but never throw.
 */
export async function logBookingToNotion(params: LogBookingParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const today = new Date().toISOString().split("T")[0];
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(params.startAt);

  const hosts = params.hostNames.length === 1
    ? params.hostNames[0]
    : params.hostNames.join(" + ");

  let nextAction = `playdate booked (${params.eventTypeSlug}): ${dateLabel} with ${hosts}`;
  if (params.curious) nextAction += ` — curious: ${params.curious}`;
  if (params.valuable) nextAction += ` — values: ${params.valuable}`;
  if (params.quadrant) nextAction += ` — quadrant: ${params.quadrant}`;
  if (nextAction.length > 2000) nextAction = nextAction.slice(0, 1997) + "…";

  const dataSourceId = await getDataSourceId(client);

  // Try to find an existing contact by email
  try {
    const queryResult = dataSourceId
      ? await (client as unknown as {
          dataSources: {
            query: (args: unknown) => Promise<{ results: { id: string }[] }>;
          };
        }).dataSources.query({
          data_source_id: dataSourceId,
          filter: { property: "email", email: { equals: params.email } },
          page_size: 1,
        })
      : await (client as unknown as {
          databases: {
            query: (args: unknown) => Promise<{ results: { id: string }[] }>;
          };
        }).databases.query({
          database_id: CRM_CONTACTS_DB,
          filter: { property: "email", email: { equals: params.email } },
          page_size: 1,
        });

    if (queryResult.results.length > 0) {
      const pageId = queryResult.results[0].id;
      await client.pages.update({
        page_id: pageId,
        properties: {
          "contact warmth": { select: { name: "warm" } },
          "last contacted": { date: { start: today } },
          "next action": { rich_text: [{ text: { content: nextAction } }] },
        },
      });
      return;
    }
  } catch (err) {
    console.warn("[booking.notion] dedup query failed:", String(err));
  }

  // Create new contact
  try {
    await client.pages.create({
      parent: { database_id: CRM_CONTACTS_DB },
      properties: {
        "first & last name": { title: [{ text: { content: params.name } }] },
        email: { email: params.email },
        "contact warmth": { select: { name: "warm" } },
        "relationship stage": { select: { name: "introduced" } },
        "last contacted": { date: { start: today } },
        "next action": { rich_text: [{ text: { content: nextAction } }] },
      },
    });
  } catch (err) {
    console.error("[booking.notion] create failed:", String(err));
  }
}

/**
 * Log a cancellation. Updates next_action on the existing contact.
 */
export async function logCancellationToNotion(params: {
  email: string;
  eventTitle: string;
  startAt: Date;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const today = new Date().toISOString().split("T")[0];
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(params.startAt);

  try {
    const result = await (client as unknown as {
      databases: {
        query: (args: unknown) => Promise<{ results: { id: string }[] }>;
      };
    }).databases.query({
      database_id: CRM_CONTACTS_DB,
      filter: { property: "email", email: { equals: params.email } },
      page_size: 1,
    });
    if (result.results.length === 0) return;
    await client.pages.update({
      page_id: result.results[0].id,
      properties: {
        "last contacted": { date: { start: today } },
        "next action": {
          rich_text: [
            { text: { content: `playdate cancelled (${params.eventTitle}, ${dateLabel})` } },
          ],
        },
      },
    });
  } catch (err) {
    console.warn("[booking.notion] cancellation log failed:", String(err));
  }
}
