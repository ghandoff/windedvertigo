/**
 * Supabase read layer for rfp_feeds — used when RFP_FEEDS_SOURCE=supabase.
 *
 * Maps Supabase rows back to the canonical `RfpFeedSource` type from
 * lib/notion/rfp-feeds. Critically: `id` is set to `notion_page_id`
 * (not the Supabase UUID) so all callers that reference Notion IDs continue
 * to work unchanged.
 */

import { supabase } from "./client";
import type { RfpFeedSource, FeedType } from "@/lib/notion/rfp-feeds";
import type { RfpSource } from "@/lib/notion/types";

interface RfpFeedRow {
  notion_page_id: string;
  name: string;
  feed_type: string | null;
  source_label: string | null;
  url: string | null;
  keywords: string | null;
  notes: string | null;
  enabled: boolean;
  last_polled: string | null;
  items_last_run: number | null;
  updated_at: string | null;
}

function mapRowToRfpFeedSource(row: RfpFeedRow): RfpFeedSource {
  return {
    id: row.notion_page_id,
    name: row.name,
    type: (row.feed_type as FeedType) ?? ("RSS Feed" as FeedType),
    sourceLabel: (row.source_label as RfpSource) ?? ("" as RfpSource),
    url: row.url ?? "",
    keywords: row.keywords ?? "",
    notes: row.notes ?? "",
    enabled: row.enabled,
    lastPolled: row.last_polled ?? null,
    itemsLastRun: row.items_last_run ?? null,
    createdTime: "",
    lastEditedTime: row.updated_at ?? "",
  };
}

const SELECT_COLS =
  "notion_page_id, name, feed_type, source_label, url, keywords, notes, enabled, last_polled, items_last_run, updated_at";

export async function getAllRfpFeedSourcesFromSupabase(): Promise<RfpFeedSource[]> {
  const { data, error } = await supabase
    .from("rfp_feeds")
    .select(SELECT_COLS)
    .order("name", { ascending: true });

  if (error) throw new Error(`[supabase/rfp-feeds] getAllRfpFeedSources: ${error.message}`);
  return (data as RfpFeedRow[]).map(mapRowToRfpFeedSource);
}
