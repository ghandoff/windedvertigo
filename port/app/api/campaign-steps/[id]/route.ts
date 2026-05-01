import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCampaignStep, updateCampaignStep, archiveCampaignStep } from "@/lib/notion/campaign-steps";
import { json, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(() => getCampaignStep(id));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return withNotionError(async () => {
    const step = await updateCampaignStep(id, body);
    // Purge ISR cache for the campaign page so status changes are immediately visible
    for (const campaignId of step.campaignIds) {
      revalidatePath(`/campaigns/${campaignId}`);
    }
    return step;
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    await archiveCampaignStep(id);
    return json({ archived: true });
  });
}
