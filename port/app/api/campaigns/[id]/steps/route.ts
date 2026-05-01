import { NextRequest } from "next/server";
import { getStepsForCampaign, createCampaignStep } from "@/lib/notion/campaign-steps";
import { json, error, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    const steps = await getStepsForCampaign(id);
    return { data: steps };
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return error("request body is required");

  // Auto-compute step number
  const existingSteps = await getStepsForCampaign(id);
  const stepNumber = existingSteps.length + 1;
  const channel = body.channel ?? "email";
  const name = body.name ?? `step ${stepNumber} — ${channel}`;

  return withNotionError(async () => {
    const step = await createCampaignStep({
      ...body,
      name,
      campaignIds: [id],
      stepNumber,
      status: body.status ?? "draft",
    });
    return json(step, 201);
  });
}
