/**
 * Regenerate an RFP's one-pager brief from its (ideally verified) TOR, and
 * refresh the TOR thumbnail. Called on-demand and whenever a real TOR arrives
 * (upload / paste / verify) so the brief stops reflecting a thin aggregator
 * description and starts reflecting the actual document.
 *
 * Provenance is DERIVED from the card's real state — never over-claimed:
 *   tor_verified_at set → "verified-tor"
 *   a TOR doc present    → "unverified-tor-doc"
 *   neither              → "description-only"
 *
 * Fail-open: best-effort, never throws.
 */

import {
  getRfpOpportunityByIdFromSupabase,
  setRfpOnePager,
  setRfpTorThumbnail,
} from "@/lib/supabase/rfp-opportunities";
import { generateOnePager } from "@/lib/ai/rfp-one-pager";
import { generateTorThumbnail } from "@/lib/rfp/tor-thumbnail";
import type { OnePager, RfpOpportunity } from "@/lib/notion/types";

/** Load grounded TOR text: fetch the R2 .txt (inline TOR) when applicable,
 *  else fall back to the extracted requirements snapshot. */
async function loadTorText(rfp: RfpOpportunity): Promise<string | undefined> {
  const url = rfp.rfpDocumentUrl;
  if (url && /\.txt(\?|$)/i.test(url)) {
    try {
      const r = await fetch(url);
      if (r.ok) return (await r.text()).slice(0, 12_000);
    } catch {
      /* fall through to snapshot */
    }
  }
  return rfp.requirementsSnapshot || undefined;
}

export interface RegenerateBriefResult {
  ok: boolean;
  sourceBasis?: OnePager["sourceBasis"];
  thumbnailUpdated?: boolean;
}

export async function regenerateBriefFromTor(
  rfpId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserBinding?: any,
): Promise<RegenerateBriefResult> {
  const rfp = await getRfpOpportunityByIdFromSupabase(rfpId).catch(() => null);
  if (!rfp) return { ok: false };

  const sourceBasis: OnePager["sourceBasis"] = rfp.torVerifiedAt
    ? "verified-tor"
    : rfp.rfpDocumentUrl
      ? "unverified-tor-doc"
      : "description-only";

  const torText = await loadTorText(rfp);

  const brief = await generateOnePager({
    opportunityName: rfp.opportunityName,
    requirementsSnapshot: rfp.requirementsSnapshot || undefined,
    decisionNotes: rfp.decisionNotes || undefined,
    torText,
    torUrl: rfp.rfpDocumentUrl ?? (rfp.url || undefined),
    source: rfp.source,
    geography: rfp.geography,
    serviceMatch: rfp.serviceMatch,
    sourceBasis,
  });
  if (brief) await setRfpOnePager(rfpId, brief.onePager);

  // Refresh the thumbnail (best-effort) if a Browser Rendering binding is available.
  let thumbnailUpdated = false;
  if (browserBinding) {
    const thumb = await generateTorThumbnail(rfpId, rfp.rfpDocumentUrl ?? rfp.url, browserBinding);
    if (thumb) {
      await setRfpTorThumbnail(rfpId, thumb);
      thumbnailUpdated = true;
    }
  }

  return { ok: !!brief, sourceBasis, thumbnailUpdated };
}

/**
 * Fire the brief+thumbnail regeneration in the background (Cloudflare
 * `waitUntil`) so an interactive action (verify / upload / paste) returns
 * immediately. Fail-open. Grabs the Browser binding from the CF context itself.
 */
export async function scheduleBriefRegen(rfpId: string): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = (await getCloudflareContext({ async: true })) as {
      env?: { BROWSER?: unknown };
      ctx?: { waitUntil?: (p: Promise<unknown>) => void };
    };
    const work = regenerateBriefFromTor(rfpId, cf.env?.BROWSER ?? null);
    if (cf.ctx?.waitUntil) cf.ctx.waitUntil(work);
    else await work;
  } catch (err) {
    console.warn("[regenerate-brief] scheduleBriefRegen failed:", err);
  }
}
