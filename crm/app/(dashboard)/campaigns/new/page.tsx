import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampaignWizard } from "@/app/components/campaign-wizard";

export default function NewCampaignPage() {
  return (
    <>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to campaigns
      </Link>
      <h1 className="text-2xl font-bold mb-6">new campaign</h1>
      <CampaignWizard />
    </>
  );
}
