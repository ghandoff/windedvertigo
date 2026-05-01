/**
 * @windedvertigo/notion — CRM contact operations
 *
 * Dedup-by-email + upsert pattern for the winded.vertigo CRM contacts
 * Notion database. Shared across site (booking/email-package) and any
 * future app that needs to log a contact touchpoint.
 *
 * Contact warmth vocabulary (matches the Notion select options):
 *   cold → lukewarm → warm → hot
 *
 * Relationship stage vocabulary (matches the Notion select options):
 *   introduced → meeting set → proposal sent → negotiation → won → lost
 */

import { Client } from "@notionhq/client";

/** The winded.vertigo CRM contacts database (shared across all apps). */
export const WV_CRM_CONTACTS_DB = "829cd552-4516-45b7-a65b-2bcd8d47ff81";

export type ContactWarmth = "cold" | "lukewarm" | "warm" | "hot";
export type RelationshipStage =
  | "introduced"
  | "meeting set"
  | "proposal sent"
  | "negotiation"
  | "won"
  | "lost";

export interface UpsertContactParams {
  /** Notion client. Caller owns creation (and token). */
  client: Client;
  /** The person's email — used as the dedup key. */
  email: string;
  /**
   * Full name — only written on CREATE, not on update (avoids overwriting
   * a manually corrected name in Notion).
   */
  name?: string;
  /** Contact warmth level. Default: "lukewarm". */
  warmth?: ContactWarmth;
  /** Relationship stage — only written on CREATE. Default: "introduced". */
  stage?: RelationshipStage;
  /**
   * ISO date string for last_contacted (e.g. "2026-04-30").
   * Defaults to today's UTC date.
   */
  lastContacted?: string;
  /**
   * Free-text next action / activity note (max 2000 chars — Notion rich-text
   * limit). Longer strings are silently truncated with "…".
   */
  nextAction?: string;
}

export interface UpsertContactResult {
  /** True when a new Notion page was created; false when an existing one was updated. */
  created: boolean;
  /** The Notion page id of the contact. */
  pageId?: string;
}

/**
 * Resolve the data source id for a Notion database.
 *
 * Notion API v2025-09-03 introduced "data sources" — queries must target
 * the data source id rather than the raw database id. This helper retrieves
 * and caches the mapping per-process.
 *
 * Falls back gracefully: if the retrieve call doesn't return a data_sources
 * field (e.g. older API version or internal DB), it returns null and the
 * caller can fall back to a direct databases.query.
 */
const _dataSourceCache = new Map<string, string>();

export async function resolveDataSourceId(
  client: Client,
  databaseId: string,
): Promise<string | null> {
  if (_dataSourceCache.has(databaseId)) {
    return _dataSourceCache.get(databaseId)!;
  }
  try {
    const db = (await client.databases.retrieve({
      database_id: databaseId,
    })) as unknown as { data_sources?: { id: string }[] };
    const id = db?.data_sources?.[0]?.id;
    if (id) {
      _dataSourceCache.set(databaseId, id);
      return id;
    }
  } catch {
    // ignore — caller falls back to databases.query
  }
  return null;
}

/**
 * Upsert a contact in the wv CRM contacts database.
 *
 * - Queries for an existing contact by email (using dataSources.query
 *   with the v5 data source id, with a fallback to databases.query).
 * - If found: updates last_contacted, next_action, and warmth.
 * - If not found: creates a new contact page with all provided fields.
 *
 * This function is non-throwing — all errors are logged and swallowed
 * because CRM logging is never worth breaking a booking or lead flow.
 */
export async function upsertCrmContact(
  params: UpsertContactParams,
): Promise<UpsertContactResult> {
  const { client, email } = params;
  const today = params.lastContacted ?? new Date().toISOString().split("T")[0];
  const warmth = params.warmth ?? "lukewarm";
  const stage = params.stage ?? "introduced";
  const rawAction = params.nextAction ?? "";
  const nextAction = rawAction.length > 2000 ? rawAction.slice(0, 1997) + "…" : rawAction;

  const dataSourceId = await resolveDataSourceId(client, WV_CRM_CONTACTS_DB);

  // ── dedup lookup ────────────────────────────────────────────────
  let existingPageId: string | undefined;
  try {
    type QueryResult = { results: { id: string }[] };
    let result: QueryResult;

    if (dataSourceId) {
      result = await (
        client as unknown as {
          dataSources: { query: (a: unknown) => Promise<QueryResult> };
        }
      ).dataSources.query({
        data_source_id: dataSourceId,
        filter: { property: "email", email: { equals: email } },
        page_size: 1,
      });
    } else {
      result = await (
        client as unknown as {
          databases: { query: (a: unknown) => Promise<QueryResult> };
        }
      ).databases.query({
        database_id: WV_CRM_CONTACTS_DB,
        filter: { property: "email", email: { equals: email } },
        page_size: 1,
      });
    }

    if (result.results.length > 0) {
      existingPageId = result.results[0].id;
    }
  } catch (err) {
    console.warn("[notion-crm] dedup query failed — will attempt create:", String(err));
  }

  // ── update existing contact ─────────────────────────────────────
  if (existingPageId) {
    try {
      await client.pages.update({
        page_id: existingPageId,
        properties: {
          "contact warmth": { select: { name: warmth } },
          "last contacted": { date: { start: today } },
          ...(nextAction
            ? { "next action": { rich_text: [{ text: { content: nextAction } }] } }
            : {}),
        },
      });
      return { created: false, pageId: existingPageId };
    } catch (err) {
      console.error("[notion-crm] update failed:", String(err));
      return { created: false, pageId: existingPageId };
    }
  }

  // ── create new contact ──────────────────────────────────────────
  try {
    const page = await client.pages.create({
      parent: { database_id: WV_CRM_CONTACTS_DB },
      properties: {
        "first & last name": {
          title: [{ text: { content: params.name ?? email } }],
        },
        email: { email },
        "contact warmth": { select: { name: warmth } },
        "relationship stage": { select: { name: stage } },
        "last contacted": { date: { start: today } },
        ...(nextAction
          ? { "next action": { rich_text: [{ text: { content: nextAction } }] } }
          : {}),
      },
    });
    return { created: true, pageId: page.id };
  } catch (err) {
    console.error("[notion-crm] create failed:", String(err));
    return { created: true };
  }
}
