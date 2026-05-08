/**
 * Port email campaign stats — sourced from Supabase `email_drafts` table.
 *
 * Counts emails the port has actually SENT (status='sent') and aggregates
 * opens, clicks, and unique recipients. Used by the strategy page sidebar
 * as a "campaign reach" metric (real first-party data we own, regardless
 * of whether social platform credentials are configured).
 */

import { getEmailDraftsByStatusFromSupabase } from "@/lib/supabase/email-drafts";

export interface PortCampaignStats {
  /** count of email_drafts with status='sent' */
  totalEmailsSent: number;
  /** sum of opens across sent drafts */
  totalOpens: number;
  /** sum of clicks across sent drafts */
  totalClicks: number;
  /** distinct sent_to addresses (rough proxy for reach) */
  uniqueRecipients: number;
  fetchedAt: string;
}

const EMPTY: PortCampaignStats = {
  totalEmailsSent: 0,
  totalOpens: 0,
  totalClicks: 0,
  uniqueRecipients: 0,
  fetchedAt: new Date(0).toISOString(),
};

/**
 * Fetch port email campaign stats. Degrades gracefully — returns zeroed
 * stats on any read error so the snapshot can still build.
 */
export async function getPortCampaignStats(): Promise<PortCampaignStats> {
  const fetchedAt = new Date().toISOString();
  try {
    const { data: drafts } = await getEmailDraftsByStatusFromSupabase("sent", 5000);
    const totalOpens = drafts.reduce((s, d) => s + (d.opens ?? 0), 0);
    const totalClicks = drafts.reduce((s, d) => s + (d.clicks ?? 0), 0);
    const unique = new Set(
      drafts.map((d) => d.sentTo).filter((to): to is string => Boolean(to)),
    );
    return {
      totalEmailsSent: drafts.length,
      totalOpens,
      totalClicks,
      uniqueRecipients: unique.size,
      fetchedAt,
    };
  } catch (err) {
    console.warn("[marketing/port-campaign-stats] read error", err);
    return { ...EMPTY, fetchedAt };
  }
}
