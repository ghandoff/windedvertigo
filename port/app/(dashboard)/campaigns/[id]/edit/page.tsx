import { notFound } from "next/navigation";
import { getCampaignByIdFromSupabase } from "@/lib/supabase/campaigns";
import { getCampaignStepsFromSupabase } from "@/lib/supabase/campaign-steps";
import { PageHeader } from "@/app/components/page-header";
import { CampaignEditForm } from "@/app/components/campaign-edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignEditPage({ params }: Props) {
  const { id } = await params;

  const [campaign, steps] = await Promise.all([
    getCampaignByIdFromSupabase(id),
    getCampaignStepsFromSupabase(id),
  ]);
  if (!campaign) notFound();

  return (
    <>
      <PageHeader title={`edit: ${campaign.name}`} />
      <CampaignEditForm campaignId={id} campaign={campaign} initialSteps={steps} />
    </>
  );
}
