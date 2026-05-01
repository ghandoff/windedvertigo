/**
 * RFP feed source resolver.
 *
 * Reads enabled feed sources from the Notion "RFP feed sources" database
 * so the team can manage them entirely from the port UI.
 */

import { queryRfpFeedSources } from "@/lib/notion/rfp-feeds";
import type { RfpSource } from "@/lib/notion/types";

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  source: RfpSource;
  label: string;
}

/** Fetch all enabled feed sources from Notion. */
export async function getAllFeeds(): Promise<FeedSource[]> {
  const { data } = await queryRfpFeedSources(true); // onlyEnabled = true
  return data
    .filter((f) => f.url?.trim()) // skip Google Alert placeholders with no URL yet
    .map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      source: f.sourceLabel ?? "RSS Feed",
      label: f.type ?? f.sourceLabel ?? "RSS Feed",
    }));
}
