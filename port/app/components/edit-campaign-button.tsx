import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Campaign } from "@/lib/notion/types";

interface EditCampaignButtonProps {
  campaign: Campaign;
}

export function EditCampaignButton({ campaign }: EditCampaignButtonProps) {
  return (
    <Link
      href={`/campaigns/${campaign.id}/edit`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" />
      edit
    </Link>
  );
}
