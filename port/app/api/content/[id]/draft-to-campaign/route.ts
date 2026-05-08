/**
 * POST /api/content/[id]/draft-to-campaign
 *
 * One-click "draft to crm campaign" — given an approved/scheduled content
 * item, create a draft campaign in Supabase seeded from the content item.
 *
 * note on type: the existing CampaignType union is
 *   "event-based" | "recurring cadence" | "one-off blast"
 * there is no "social" type, so we use "recurring cadence" as the closest
 * match for ongoing social posting and tag the source in `notes`. expanding
 * the union is out of scope for this endpoint.
 */

import { NextRequest } from "next/server";
import { getContentDraftByIdFromSupabase } from "@/lib/supabase/content";
import { upsertCampaignToSupabase } from "@/lib/supabase/campaigns";
import { json, error } from "@/lib/api-helpers";

const ALLOWED_STATUSES = new Set(["approved", "scheduled"]);
const NOTES_BODY_LIMIT = 1500;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let draft;
  try {
    draft = await getContentDraftByIdFromSupabase(id);
  } catch (err) {
    console.error("[api/content/[id]/draft-to-campaign] lookup failed:", err);
    return error("failed to load content item", 500);
  }

  if (!draft) return error("content item not found", 404);

  if (!ALLOWED_STATUSES.has(draft.status)) {
    return error(
      `content must be approved or scheduled (current: ${draft.status})`,
      400,
    );
  }

  const baseName = draft.title?.trim() || "untitled draft";
  const name = baseName.toLowerCase().startsWith("social")
    ? baseName
    : `social: ${baseName}`;

  const truncatedBody = (draft.body ?? "").slice(0, NOTES_BODY_LIMIT);
  const truncationSuffix =
    (draft.body ?? "").length > NOTES_BODY_LIMIT ? "…" : "";
  const notes = [
    truncatedBody + truncationSuffix,
    "",
    `[generated from content item ${draft.id} on ${new Date().toISOString().slice(0, 10)}]`,
  ]
    .filter((part, idx) => idx === 0 || part !== "")
    .join("\n");

  const campaignId = crypto.randomUUID();

  try {
    await upsertCampaignToSupabase(campaignId, {
      name,
      // closest existing CampaignType — see header comment
      type: "recurring cadence",
      status: "draft",
      event_ids: [],
      audience_filters: { source: ["internal"] },
      owner: draft.author ?? null,
      start_date: draft.scheduledDate ?? null,
      end_date: null,
      notes,
    });
  } catch (err) {
    console.error("[api/content/[id]/draft-to-campaign] create failed:", err);
    return error("failed to create campaign", 500);
  }

  return json(
    {
      campaignId,
      redirectUrl: `/campaigns/${campaignId}`,
    },
    201,
  );
}
