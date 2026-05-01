import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/notion/campaigns";
import { getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { PageHeader } from "@/app/components/page-header";
import { CampaignEditForm } from "@/app/components/campaign-edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignEditPage({ params }: Props) {
  const { id } = await params;

  let campaign;
  try {
    campaign = await getCampaign(id);
  } catch {
    notFound();
  }

  const steps = await getStepsForCampaign(id);

  return (
    <>
      <PageHeader title={`edit: ${campaign.name}`} />
      <CampaignEditForm campaignId={id} campaign={campaign} initialSteps={steps} />
    </>
  );
}
